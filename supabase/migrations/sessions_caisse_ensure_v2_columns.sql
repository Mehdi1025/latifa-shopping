-- Exécuté APRÈS caisse_sessions.sql (ordre lexicographique) : corriger les projets
-- où la table a été créée avec l'ancien schéma (fond_de_caisse, etc.).

DO $fix$
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'details_comptage'
  ) THEN
    ALTER TABLE public.sessions_caisse ADD COLUMN details_comptage jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'sessions_caisse_fermee_heure_fermeture_idx'
  ) THEN
    CREATE INDEX sessions_caisse_fermee_heure_fermeture_idx
      ON public.sessions_caisse (heure_fermeture DESC)
      WHERE statut = 'fermee' AND heure_fermeture IS NOT NULL;
  END IF;
END
$fix$;
