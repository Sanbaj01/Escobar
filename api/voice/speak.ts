import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text content is required' });
  }

  try {
    const cleanedText = text.trim().toLowerCase();
    
    // Hash text to use as cache key
    const textHash = crypto.createHash('md5').update(cleanedText).digest('hex');
    const fileKey = `${user.id}/${textHash}.mp3`;
    
    // Check Cache
    try {
      const { data: cachedBlob, error: downloadError } = await supabaseServer.storage
        .from('audio-cache')
        .download(fileKey);
        
      if (cachedBlob) {
        const arrayBuffer = await cachedBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', buffer.length.toString());
        res.write(buffer);
        res.end();
        return;
      }
    } catch (cacheErr) {
      // Ignore cache check errors, fall back to API call
      console.warn('Cache lookup failed, calling API:', cacheErr);
    }

    // Cache Miss -> Request from ElevenLabs
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice if not set
    
    if (!elevenLabsApiKey) {
      return res.status(500).json({ error: 'ElevenLabs API Key is missing on the server' });
    }

    const elevenLabsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.8,
          style: 0.45,
        },
      }),
    });

    if (!elevenLabsRes.ok) {
      const errText = await elevenLabsRes.text();
      console.error('ElevenLabs TTS failed:', errText);
      return res.status(502).json({ error: 'ElevenLabs API error: ' + errText });
    }

    res.setHeader('Content-Type', 'audio/mpeg');

    // Read response stream to buffer so we can cache it, and also stream it back to client
    const reader = elevenLabsRes.body?.getReader();
    const chunks: Uint8Array[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          res.write(Buffer.from(value));
        }
      }
    }
    res.end();

    // Async cache storage update in background
    if (chunks.length > 0) {
      const fullAudioBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
      
      // Upload to Supabase Storage in the background (will fail if bucket or folder doesn't exist, but won't crash user thread)
      supabaseServer.storage
        .from('audio-cache')
        .upload(fileKey, fullAudioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        })
        .then(({ error: uploadError }) => {
          if (uploadError) {
            console.error('Failed to upload cached audio:', uploadError);
          }
        })
        .catch(err => {
          console.error('Async cache upload failed:', err);
        });
    }

  } catch (err: any) {
    console.error('TTS Speak handler error:', err);
    if (!res.writableEnded) {
      res.status(500).json({ error: err.message || 'Internal speak error' });
    }
  }
}
