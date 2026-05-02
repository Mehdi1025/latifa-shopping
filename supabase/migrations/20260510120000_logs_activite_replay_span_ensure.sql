-- Idempotent: safe if `20260509131000_logs_activite_replay_span_ms.sql` already ran remotely.

CREATE OR REPLACE FUNCTION public.logs_rrweb_span_ms(events jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  row_rec RECORD;
  t bigint;
  mn bigint;
  mx bigint;
BEGIN
  IF events IS NULL OR jsonb_typeof(events) <> 'array' THEN
    RETURN NULL;
  END IF;

  IF jsonb_array_length(events) < 2 THEN
    RETURN NULL;
  END IF;

  mn := NULL;
  mx := NULL;

  FOR row_rec IN SELECT * FROM jsonb_array_elements(events)
  LOOP
    IF row_rec.value IS NULL OR NOT row_rec.value ? 'timestamp' THEN
      CONTINUE;
    END IF;

    BEGIN
      t := (row_rec.value ->> 'timestamp')::bigint;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;

    IF mn IS NULL OR t < mn THEN mn := t; END IF;
    IF mx IS NULL OR t > mx THEN mx := t; END IF;
  END LOOP;

  IF mn IS NULL OR mx IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN LEAST(GREATEST(0::bigint, mx - mn), 2147483647::bigint)::integer;
END;
$$;

ALTER TABLE public.logs_activite
  ADD COLUMN IF NOT EXISTS replay_span_ms integer NULL;

COMMENT ON COLUMN public.logs_activite.replay_span_ms IS
  'Δ ms max(timestamp) − min(timestamp) événements rrweb (filtre VAR vs timelines ~0 s)';

UPDATE public.logs_activite
SET replay_span_ms = public.logs_rrweb_span_ms(enregistrement_ecran)
WHERE enregistrement_ecran IS NOT NULL;

CREATE INDEX IF NOT EXISTS logs_activite_replay_span_var_idx
  ON public.logs_activite (created_at DESC)
  WHERE replay_span_ms IS NOT NULL AND replay_span_ms >= 500;
