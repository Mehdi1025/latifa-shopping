-- Organisation : statuts canoniques pour les tâches + calendrier éditorial

ALTER TABLE public.taches ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'a_faire';

-- 1) Normaliser les valeurs existantes vers a_faire | en_cours | termine
UPDATE public.taches
SET statut = 'a_faire'
WHERE statut IS NULL OR statut IN ('À faire', 'a_faire');

UPDATE public.taches
SET statut = 'en_cours'
WHERE statut IN ('En cours', 'en_cours');

UPDATE public.taches
SET statut = 'termine'
WHERE statut IN ('Terminé', 'Termine', 'termine');

UPDATE public.taches
SET statut = 'a_faire'
WHERE statut NOT IN ('a_faire', 'en_cours', 'termine');

ALTER TABLE public.taches
  ALTER COLUMN statut SET DEFAULT 'a_faire';

ALTER TABLE public.taches DROP CONSTRAINT IF EXISTS taches_statut_check;

ALTER TABLE public.taches
  ADD CONSTRAINT taches_statut_check CHECK (statut IN ('a_faire', 'en_cours', 'termine'));

COMMENT ON COLUMN public.taches.statut IS 'Workflow Kanban : a_faire, en_cours, termine';

-- 2) Calendrier éditorial (réseaux sociaux / contenus)
CREATE TABLE IF NOT EXISTS public.editorial_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  plateforme TEXT NOT NULL,
  date_publication TIMESTAMPTZ NOT NULL,
  statut TEXT NOT NULL DEFAULT 'planifie',
  contenu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editorial_calendar_date_idx
  ON public.editorial_calendar (date_publication ASC);

COMMENT ON TABLE public.editorial_calendar IS 'Posts et contenus planifiés (Instagram, TikTok, etc.)';

ALTER TABLE public.editorial_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editorial_calendar_select_authenticated" ON public.editorial_calendar;
DROP POLICY IF EXISTS "editorial_calendar_insert_authenticated" ON public.editorial_calendar;
DROP POLICY IF EXISTS "editorial_calendar_update_authenticated" ON public.editorial_calendar;
DROP POLICY IF EXISTS "editorial_calendar_delete_authenticated" ON public.editorial_calendar;

CREATE POLICY "editorial_calendar_select_authenticated"
  ON public.editorial_calendar FOR SELECT TO authenticated USING (true);

CREATE POLICY "editorial_calendar_insert_authenticated"
  ON public.editorial_calendar FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "editorial_calendar_update_authenticated"
  ON public.editorial_calendar FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "editorial_calendar_delete_authenticated"
  ON public.editorial_calendar FOR DELETE TO authenticated USING (true);
