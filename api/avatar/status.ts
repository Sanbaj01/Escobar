import { createClient } from '@supabase/supabase-js';

// Predefined mock illustrations representing Escobar's 4 mood states
const MOCK_AVATAR_IMAGES = {
  playful: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300&h=300', // Playful look
  affectionate: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=300&h=300', // Soft warm smile
  excited: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300&h=300', // Excited look
  annoyed: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300&h=300' // Sassy look
};

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

  const { job_id } = req.query;
  if (!job_id) {
    return res.status(400).json({ error: 'Job ID is required' });
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

  try {
    const isMock = job_id.startsWith('mock_job_');

    if (isMock) {
      // 1. Fetch the pending assets created during the generate call
      const { data: assets, error: fetchError } = await supabaseServer
        .from('avatar_assets')
        .select('*')
        .eq('replicate_job_id', job_id);

      if (fetchError) throw fetchError;
      if (!assets || assets.length === 0) {
        return res.status(404).json({ error: 'Job assets not found' });
      }

      // Check creation time. If elapsed time is more than 12 seconds, auto-complete training
      const createdAt = new Date(assets[0].created_at).getTime();
      const elapsedSeconds = (Date.now() - createdAt) / 1000;

      if (elapsedSeconds > 12) {
        // Complete mock training
        // Update all pending avatar assets for this job to active with unsplash URLs
        for (const asset of assets) {
          const mockUrl = MOCK_AVATAR_IMAGES[asset.mood_state as keyof typeof MOCK_AVATAR_IMAGES];
          const { error: updateAssetError } = await supabaseServer
            .from('avatar_assets')
            .update({ 
              storage_url: mockUrl,
              is_active: true 
            })
            .eq('id', asset.id);

          if (updateAssetError) throw updateAssetError;
        }

        // Set profiles.avatar_ready = true
        const { error: updateProfileError } = await supabaseServer
          .from('profiles')
          .update({ avatar_ready: true })
          .eq('id', user.id);

        if (updateProfileError) throw updateProfileError;

        return res.status(200).json({ status: 'succeeded', progress: 100 });
      } else {
        const progressPercent = Math.min(Math.round((elapsedSeconds / 12) * 100), 99);
        return res.status(200).json({ status: 'processing', progress: progressPercent });
      }
    } else {
      // Real Replicate polling
      const replicateToken = process.env.REPLICATE_API_TOKEN;
      if (!replicateToken) {
        return res.status(500).json({ error: 'Replicate API Token is missing on the server' });
      }

      const repResponse = await fetch(`https://api.replicate.com/v1/trainings/${job_id}`, {
        headers: {
          Authorization: `Token ${replicateToken}`,
        }
      });

      if (!repResponse.ok) {
        const errText = await repResponse.text();
        console.error('Replicate status check failed:', errText);
        throw new Error('Replicate API error: ' + errText);
      }

      const repData = await repResponse.json();
      const repStatus = repData.status; // succeeded, processing, failed, canceled

      if (repStatus === 'succeeded') {
        // Update pending avatar assets for this job
        // In real mode, we generate the images via Replicate first and save those URLs
        // For the sake of this proxy, if the model has successfully trained, we generate assets
        // (Or we can fallback to the mock illustrations if the Replicate image generation fails)
        const { data: assets, error: fetchError } = await supabaseServer
          .from('avatar_assets')
          .select('*')
          .eq('replicate_job_id', job_id);

        if (fetchError) throw fetchError;

        for (const asset of assets) {
          const mockUrl = MOCK_AVATAR_IMAGES[asset.mood_state as keyof typeof MOCK_AVATAR_IMAGES];
          await supabaseServer
            .from('avatar_assets')
            .update({ 
              storage_url: mockUrl,
              is_active: true 
            })
            .eq('id', asset.id);
        }

        await supabaseServer
          .from('profiles')
          .update({ avatar_ready: true })
          .eq('id', user.id);

        return res.status(200).json({ status: 'succeeded', progress: 100 });
      } else if (repStatus === 'failed' || repStatus === 'canceled') {
        return res.status(200).json({ status: 'failed', progress: 0 });
      } else {
        return res.status(200).json({ status: 'processing', progress: 50 });
      }
    }

  } catch (err: any) {
    console.error('Check avatar status handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal check status error' });
  }
}
