-- Migration: 003_messages.sql
-- Creates public.messages table, indexing for scroll performance, conversation timestamp update trigger, and RLS.

CREATE TABLE public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  audio_url       TEXT,
  mood_state      TEXT        CHECK (mood_state IN
                    ('playful','affectionate','excited','annoyed')),
  language_ratio  FLOAT4      CHECK (language_ratio BETWEEN 0.0 AND 1.0),
  corrections     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  embedded        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_id_idx
  ON public.messages(conversation_id, created_at DESC);

CREATE INDEX messages_user_id_idx
  ON public.messages(user_id);

CREATE INDEX messages_not_embedded_idx
  ON public.messages(user_id)
  WHERE embedded = FALSE AND role = 'assistant';

-- Auto-bump conversation updated_at on new message
CREATE OR REPLACE FUNCTION bump_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_bump_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE bump_conversation_updated_at();

-- Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own messages"
  ON public.messages FOR ALL
  USING (auth.uid() = user_id);
