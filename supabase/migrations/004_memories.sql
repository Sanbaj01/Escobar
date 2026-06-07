-- Migration: 004_memories.sql
-- Installs the pgvector memory store table, similarity indexes, and query RPC function.

-- Requires: pgvector extension (Migration 000)
CREATE TABLE public.memories (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT          NOT NULL,
  embedding   vector(1536)  NOT NULL,
  type        TEXT          NOT NULL DEFAULT 'episodic'
              CHECK (type IN ('episodic','semantic','correction','preference')),
  source_ids  UUID[]        NOT NULL DEFAULT '{}'::uuid[],
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- IVFFlat index for cosine similarity search (lists=100 is appropriate for < 1M rows)
CREATE INDEX memories_embedding_idx
  ON public.memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX memories_user_id_idx
  ON public.memories(user_id, created_at DESC);

-- Memory retrieval function (top-5 semantic match)
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding  vector(1536),
  match_user_id    UUID,
  match_count      INT DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, type TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.type,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.memories m
  WHERE m.user_id = match_user_id
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Row Level Security
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memories"
  ON public.memories FOR ALL
  USING (auth.uid() = user_id);
