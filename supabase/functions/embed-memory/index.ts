// supabase/functions/embed-memory/index.ts
// Deno Edge Function to asynchronously generate embeddings for long-term memories

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { user_id, message_ids, content_summary, memory_type = 'episodic' } = await req.json()

    if (!user_id || !content_summary || !message_ids || !Array.isArray(message_ids)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set")
    }

    // 1. Generate text embeddings via OpenAI text-embedding-3-small
    const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: content_summary
      })
    })

    if (!embedRes.ok) {
      const errText = await embedRes.text()
      throw new Error(`OpenAI Embeddings request failed: ${errText}`)
    }

    const { data } = await embedRes.json()
    const embedding = data[0].embedding

    // 2. Initialize Supabase client with Service Role Key (bypassing RLS for system sync write)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })

    // 3. Store the embedded summary in the memories table
    const { error: insertError } = await supabase
      .from("memories")
      .insert({
        user_id,
        content: content_summary,
        embedding,
        type: memory_type,
        source_ids: message_ids
      })

    if (insertError) throw insertError;

    // 4. Mark source messages as processed / embedded = true
    const { error: updateError } = await supabase
      .from("messages")
      .update({ embedded: true })
      .in("id", message_ids)

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (err: any) {
    console.error("Embed memory function error:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal embedding error" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})
