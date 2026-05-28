-- Migration: 006_avatar_assets.sql
-- Creates public.avatar_assets table, ensures only one set of active mood images exists, and sets RLS.

CREATE TABLE public.avatar_assets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood_state    TEXT        NOT NULL
                CHECK (mood_state IN ('playful','affectionate','excited','annoyed')),
  storage_url   TEXT        NOT NULL,
  rive_file_url TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  replicate_job_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX avatar_assets_user_mood_active_idx
  ON public.avatar_assets(user_id, mood_state)
  WHERE is_active = TRUE;

CREATE INDEX avatar_assets_user_id_idx
  ON public.avatar_assets(user_id);

-- Ensure only one active set of mood states per user
CREATE OR REPLACE FUNCTION deactivate_old_avatars()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.avatar_assets
    SET is_active = FALSE
    WHERE user_id = NEW.user_id
      AND mood_state = NEW.mood_state
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER avatar_single_active
  AFTER INSERT OR UPDATE ON public.avatar_assets
  FOR EACH ROW EXECUTE PROCEDURE deactivate_old_avatars();

-- Row Level Security
ALTER TABLE public.avatar_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own avatar assets"
  ON public.avatar_assets FOR ALL
  USING (auth.uid() = user_id);
