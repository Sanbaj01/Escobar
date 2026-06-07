import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false, // Disables default body parser to read binary stream
  },
};

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

  try {
    // Read raw binary request stream
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty audio payload' });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return res.status(500).json({ error: 'OpenAI API Key is missing on the server' });
    }

    // Convert Buffer to standard File/Blob for FormData
    const contentType = req.headers['content-type'] || 'audio/webm';
    const audioBlob = new Blob([audioBuffer], { type: contentType });
    const audioFile = new File([audioBlob], 'audio.webm', { type: contentType });

    // Construct standard web FormData
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'es'); // Spanish language hint
    formData.append('prompt', 'maje, cheque, puej si, pucha, chiguín, Escobar, caliche'); // Seeding Honduran caliche accuracy

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper transcription failed:', errorText);
      return res.status(502).json({ error: 'Whisper API error: ' + errorText });
    }

    const transcriptionData = await whisperResponse.json();
    return res.status(200).json({ text: transcriptionData.text });

  } catch (err: any) {
    console.error('Transcription handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal transcription error' });
  }
}
