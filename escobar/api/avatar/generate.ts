import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Malformed authorization token' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server environment misconfiguration' });
  }

  const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Verify User JWT
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { photo_urls } = req.body;
  if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
    return res.status(400).json({ error: 'Photo URLs array is required' });
  }

  try {
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    const isMockMode = !replicateToken || replicateToken === 'your-replicate-api-token' || replicateToken.startsWith('r8_placeholder');

    let jobId = '';

    if (isMockMode) {
      // Simulation mode
      console.log('REPLICATE_API_TOKEN is missing or using placeholder. Running avatar LoRA generation in simulation mode.');
      jobId = `mock_job_${Math.random().toString(36).substring(2, 12)}`;
    } else {
      // Call Replicate API to trigger training
      // Using flux-dev-lora-trainer
      const replicateResponse = await fetch('https://api.replicate.com/v1/trainings', {
        method: 'POST',
        headers: {
          Authorization: `Token ${replicateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Training settings
          input: {
            input_images: photo_urls[0], // Normally needs a zip file, we pass photo URL or first photo for training configuration
            steps: 1000,
          },
          // Destination model: owner/model_name
          model: `project-escobar-user-${user.id}`,
          trainer_version: 'ostris/flux-dev-lora-trainer'
        }),
      });

      if (!replicateResponse.ok) {
        const errorText = await replicateResponse.text();
        console.error('Replicate training trigger failed:', errorText);
        throw new Error('Replicate API error: ' + errorText);
      }

      const trainingData = await replicateResponse.json();
      jobId = trainingData.id;
    }

    // Insert pending job record in avatar_assets for tracking
    // We insert 4 pending records (one for each mood) to track the job progress
    const moods = ['playful', 'affectionate', 'excited', 'annoyed'];
    for (const mood of moods) {
      const { error: insertError } = await supabaseServer
        .from('avatar_assets')
        .insert({
          user_id: user.id,
          mood_state: mood,
          storage_url: 'pending', // Placeholder until generation finishes
          is_active: false,       // Inactive until succeeded
          replicate_job_id: jobId
        });

      if (insertError) throw insertError;
    }

    return res.status(200).json({ job_id: jobId, mock_mode: isMockMode });

  } catch (err: any) {
    console.error('Generate avatar handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal generate avatar error' });
  }
}
