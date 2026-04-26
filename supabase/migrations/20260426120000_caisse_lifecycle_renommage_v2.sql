-- Renommage des colonnes sessions_caisse (v1) → cycle de vie (v2) + details_comptage
-- S'exécute seulement si l'ancienne forme est présente (bases déjà migrées avec caisse_sessions.sql v1)

DO $migration$
BEGIN
  IF to_regclass('public.sessions_caisse') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'fond_de_caisse'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'fond_initial'
  ) THEN
    ALTER TABLE public.sessions_caisse RENAME COLUMN fond_de_caisse TO fond_initial;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'total_ventes_especes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'ventes_especes'
  ) THEN
    ALTER TABLE public.sessions_caisse RENAME COLUMN total_ventes_especes TO ventes_especes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'total_declare_especes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'total_declare'
  ) THEN
    ALTER TABLE public.sessions_caisse RENAME COLUMN total_declare_especes TO total_declare;
  END IF;

  ALTER TABLE public.sessions_caisse
    ADD COLUMN IF NOT EXISTS details_comptage jsonb;

  CREATE INDEX IF NOT EXISTS sessions_caisse_fermee_heure_fermeture_idx
    ON public.sessions_caisse (heure_fermeture DESC)
    WHERE statut = 'fermee' AND heure_fermeture IS NOT NULL;
END
$migration$;
