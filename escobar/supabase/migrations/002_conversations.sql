-- Migration: 002_conversations.sql
-- Creates public.conversations table, indexes for user query speed, and configures RLS.

CREATE TABLE public.conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT,
  mode        TEXT        NOT NULL DEFAULT 'chat'
              CHECK (mode IN ('chat', 'voice', 'habla_conmigo')),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversations_user_id_idx
  ON public.conversations(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX conversations_updated_at_idx
  ON public.conversations(updated_at DESC);

-- Auto-update updated_at trigger
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id);
