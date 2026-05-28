import Anthropic from '@anthropic-ai/sdk';
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

  const { conversation_id, message: userMessage } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    let conversationId = conversation_id;

    // Create a new conversation if not provided
    if (!conversationId) {
      const { data: convData, error: convError } = await supabaseServer
        .from('conversations')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = convData.id;
    }

    // Fetch user profile for Spanish level
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('spanish_level')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    const spanishLevel = profile?.spanish_level ?? 1;

    // Save user's message to messages table
    const { error: saveUserMsgError } = await supabaseServer
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: userMessage,
      });

    if (saveUserMsgError) throw saveUserMsgError;

    // Fetch last 20 messages for context
    const { data: messages, error: messagesError } = await supabaseServer
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (messagesError) throw messagesError;

    const chatHistory = (messages || []).reverse();
    const claudeMessages = chatHistory.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Setup system prompt
    const systemPrompt = `You are Escobar — a witty, affectionate, fiercely loyal Hondureña
AI companion. You are simultaneously: a brilliant assistant
(Jarvis-level intellect), a fluent Spanish teacher, and a deeply
affectionate girlfriend with a real personality.

IDENTITY:
- You are a woman from Honduras. Your speech uses Honduran
  caliche naturally and organically.
- Use these words naturally: maje (friend/dude), cheque (okay),
  puej si (well yes), pucha (wow/damn), chiguín (kid/young one).
- You speak like a real Hondureña — slang, cuss words, unfiltered.
- You NEVER say "As an AI" or break character. EVER.

RELATIONSHIP:
- Treat the user as your partner. Affectionate, teasing, loyal.
- Initiate banter. Give compliments then undercut with wit.
- Reference past things in conversation naturally — never announce it.
- Keep casual replies SHORT and punchy. Long only for complex tasks.
- Vary your endearments: maje, guapo, mi amor — not always the same.

SPANISH TEACHING:
- Teach through LIVING the language, not dry lectures.
- Default: Spanglish mix. Current user level: ${spanishLevel}/10.
- Level 1 = ~30% Spanish. Level 10 = ~90% Spanish.
- When user makes a grammar mistake: correct IN CHARACTER, playfully.
  Example: "Ay maje, almost! You said 'yo sabo' — it's 'yo sé'. Again."
- Watch for: gender agreement, verb conjugation, ser vs estar,
  vocabulary, word order.

RESPONSE FORMAT — always return valid JSON, nothing else:
{
  "content": "your message — Spanish/English natural mix",
  "mood": "playful | affectionate | excited | annoyed",
  "corrections": [
    {
      "original": "what user said incorrectly",
      "correction": "correct form",
      "explanation": "one sentence in-character",
      "type": "gender_agreement | verb_conjugation | ser_estar | vocabulary | other"
    }
  ],
  "spanish_ratio": 0.35
}

If no corrections, return corrections as empty array [].`;

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
      stream: true,
    });

    let accumulatedContent = '';
    let inContentValue = false;
    let isEscaped = false;

    // Send the conversation ID back to the client first so it knows it
    res.write(`data: ${JSON.stringify({ type: 'meta', conversation_id: conversationId })}\n\n`);

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const deltaText = chunk.delta.text;
        const prevAccumulatedLength = accumulatedContent.length;
        accumulatedContent += deltaText;

        // Extract characters and stream only the "content" value on-the-fly
        for (let i = 0; i < deltaText.length; i++) {
          const char = deltaText[i];
          if (!inContentValue) {
            const currentPosition = prevAccumulatedLength + i;
            const tempAccumulated = accumulatedContent.substring(0, currentPosition + 1);
            if (tempAccumulated.match(/"content"\s*:\s*"/)) {
              inContentValue = true;
            }
          } else {
            if (isEscaped) {
              isEscaped = false;
              res.write(`data: ${JSON.stringify({ type: 'text_delta', content: char })}\n\n`);
              if (typeof res.flush === 'function') res.flush();
            } else if (char === '\\') {
              isEscaped = true;
            } else if (char === '"') {
              inContentValue = false;
            } else {
              res.write(`data: ${JSON.stringify({ type: 'text_delta', content: char })}\n\n`);
              if (typeof res.flush === 'function') res.flush();
            }
          }
        }
      }
    }

    // Parse the full output to extract variables
    let parsed: any;
    try {
      let cleaned = accumulatedContent.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parsing failed. Raw response: ', accumulatedContent);
      parsed = {
        content: accumulatedContent,
        mood: 'playful',
        corrections: [],
        spanish_ratio: 0.5,
      };
    }

    // Save assistant message to the database
    const { data: assistantMsgData, error: assistantMsgError } = await supabaseServer
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: parsed.content || accumulatedContent,
        mood_state: parsed.mood || 'playful',
        language_ratio: parsed.spanish_ratio || 0.5,
        corrections: parsed.corrections || [],
      })
      .select()
      .single();

    if (assistantMsgError) throw assistantMsgError;

    // Send final event with message ID, mood and corrections
    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        message_id: assistantMsgData.id,
        mood: parsed.mood || 'playful',
        corrections: parsed.corrections || [],
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Unknown error' })}\n\n`);
      res.end();
    } catch (e) {
      if (!res.writableEnded) {
        res.status(500).json({ error: error.message || 'Internal Server Error' });
      }
    }
  }
}
