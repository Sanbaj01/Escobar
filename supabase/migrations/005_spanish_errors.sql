-- Migration: 005_spanish_errors.sql
-- Creates public.spanish_errors table for grammar drills and assessment metrics.

CREATE TABLE public.spanish_errors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  error_type  TEXT        NOT NULL
              CHECK (error_type IN (
                'gender_agreement', 'verb_conjugation', 'ser_estar',
                'vocabulary', 'word_order', 'subjunctive', 'other'
              )),
  example     TEXT        NOT NULL,
  correction  TEXT        NOT NULL,
  count       INT4        NOT NULL DEFAULT 1,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_id  UUID        REFERENCES public.messages(id) ON DELETE SET NULL
);

CREATE INDEX spanish_errors_user_id_count_idx
  ON public.spanish_errors(user_id, count DESC);

-- Upsert utility function: increments correction counter if mistake already logged
CREATE OR REPLACE FUNCTION upsert_spanish_error(
  p_user_id    UUID,
  p_error_type TEXT,
  p_example    TEXT,
  p_correction TEXT,
  p_message_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.spanish_errors
  WHERE user_id = p_user_id
    AND error_type = p_error_type
    AND correction = p_correction
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.spanish_errors
    SET count = count + 1, last_seen = NOW(), message_id = p_message_id
    WHERE id = v_id;
  ELSE
    INSERT INTO public.spanish_errors
      (user_id, error_type, example, correction, message_id)
    VALUES
      (p_user_id, p_error_type, p_example, p_correction, p_message_id)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Row Level Security
ALTER TABLE public.spanish_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own errors"
  ON public.spanish_errors FOR ALL
  USING (auth.uid() = user_id);
