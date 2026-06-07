// Refactored to local Ollama instead of Anthropic
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

  const { conversation_id, message: userMessage, scenario } = req.body;
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

    // Fetch top 3 recurring errors
    const { data: topErrors } = await supabaseServer
      .from('spanish_errors')
      .select('error_type, correction, count')
      .eq('user_id', user.id)
      .order('count', { ascending: false })
      .limit(3);

    // Fetch memories if userMessage and OpenAI key are present
    let memoriesText = '';
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (openAiApiKey && userMessage) {
      try {
        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: userMessage
          })
        });

        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const queryEmbedding = embedData.data[0].embedding;

          const { data: matchedMemories, error: matchError } = await supabaseServer.rpc(
            'match_memories',
            {
              query_embedding: queryEmbedding,
              match_user_id: user.id,
              match_count: 5
            }
          );

          if (!matchError && matchedMemories && matchedMemories.length > 0) {
            memoriesText = matchedMemories
              .map((m: any) => `- [Type: ${m.type}] ${m.content}`)
              .join('\n');
          }
        }
      } catch (err) {
        console.error('Error matching memories:', err);
      }
    }

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
    let systemPrompt = `You are Escobar — a witty, affectionate, fiercely loyal Hondureña
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
  vocabulary, word order.`;

    if (topErrors && topErrors.length > 0) {
      systemPrompt += `\n\nUSER'S TOP RECURRING GRAMMAR ERRORS (reinforce corrections when appropriate):` +
        topErrors.map((e: any) => `\n- Type: ${e.error_type}, Correction to reinforce: "${e.correction}" (seen ${e.count} times)`).join('');
    }

    if (memoriesText) {
      systemPrompt += `\n\nRELEVANT RECALL / SEMANTIC MEMORIES OF PAST DISCUSSIONS (reference naturally if fitting):` +
        `\n${memoriesText}`;
    }

    if (scenario) {
      systemPrompt += `\n\nACTIVE ROLE-PLAY SCENARIO: "${scenario.name}"` +
        `\nSCENARIO CONTEXT & PROMPT: ${scenario.prompt}` +
        `\nStay in this specific role and scenario throughout this response. The user is actively role-playing this scenario with you!`;
    }

    systemPrompt += `\n\nRESPONSE FORMAT — always return valid JSON, nothing else:
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
  "spanish_ratio": 0.35,
  "memory_summary": "Optional: a concise, third-person summary of a new fact, event, or preference to remember about the user (e.g. 'User likes spicy food' or 'User is traveling to Spain next week'). Leave empty/null if nothing new or noteworthy was revealed in this turn.",
  "memory_type": "episodic | semantic | correction | preference"
}

If no corrections, return corrections as empty array [].`;

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const ollamaUrl = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';

    console.log(`Ollama: Calling ${ollamaModel} at ${ollamaUrl}...`);
    const ollamaResponse = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...claudeMessages
        ],
        stream: true,
      }),
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text();
      throw new Error(`Ollama API error: ${errText}`);
    }

    let accumulatedContent = '';
    let inContentValue = false;
    let isEscaped = false;

    // Send the conversation ID back to the client first so it knows it
    res.write(`data: ${JSON.stringify({ type: 'meta', conversation_id: conversationId })}\n\n`);

    const reader = ollamaResponse.body;
    if (!reader) throw new Error('Ollama: empty stream body');

    const decoder = new TextDecoder();
    let streamBuffer = '';

    for await (const chunk of reader as any) {
      const chunkText = decoder.decode(chunk, { stream: true });
      streamBuffer += chunkText;
      const lines = streamBuffer.split('\n');
      streamBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.substring(6);
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const deltaText = data.choices?.[0]?.delta?.content;
            if (deltaText) {
              const prevAccumulatedLength = accumulatedContent.length;
              accumulatedContent += deltaText;

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
          } catch (e) {
            // Partial JSON chunk
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

    // Asynchronously log user errors in the database if they exist
    if (parsed.corrections && Array.isArray(parsed.corrections) && parsed.corrections.length > 0) {
      for (const corr of parsed.corrections) {
        supabaseServer.rpc('upsert_spanish_error', {
          p_user_id: user.id,
          p_error_type: corr.type || 'other',
          p_example: corr.original || '',
          p_correction: corr.correction || '',
          p_message_id: assistantMsgData.id
        }).catch((e: any) => console.error('Error logging spanish error:', e));
      }
    }

    // Asynchronously trigger embedding long-term memory if summary is returned
    if (parsed.memory_summary && parsed.memory_summary.trim()) {
      const functionUrl = `${supabaseUrl}/functions/v1/embed-memory`;
      fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          user_id: user.id,
          message_ids: [assistantMsgData.id],
          content_summary: parsed.memory_summary.trim(),
          memory_type: parsed.memory_type || 'episodic'
        })
      }).then(fRes => {
        if (!fRes.ok) {
          console.error('Failed to trigger embed-memory:', fRes.statusText);
        }
      }).catch(err => {
        console.error('Error calling embed-memory edge function:', err);
      });
    }

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
