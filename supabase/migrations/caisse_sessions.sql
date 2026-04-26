-- Sessions d'ouverture / fermeture de caisse — cycle (fond hérité → ventes → comptage → écart)
-- En premier : aligner un ancien schéma (fond_de_caisse, …) sur v2, sinon les COMMENT / app échouent.

DO $pre$
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
END
$pre$;

CREATE TABLE IF NOT EXISTS public.sessions_caisse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heure_ouverture timestamptz NOT NULL,
  heure_fermeture timestamptz,
  fond_initial numeric(14, 2) NOT NULL CHECK (fond_initial >= 0),
  ventes_especes numeric(14, 2) NOT NULL DEFAULT 0,
  total_declare numeric(14, 2),
  ecart numeric(14, 2),
  statut text NOT NULL CHECK (statut IN ('ouverte', 'fermee')),
  details_comptage jsonb
);

CREATE INDEX IF NOT EXISTS sessions_caisse_statut_idx
  ON public.sessions_caisse (statut);

CREATE INDEX IF NOT EXISTS sessions_caisse_heure_ouverture_idx
  ON public.sessions_caisse (heure_ouverture DESC);

CREATE INDEX IF NOT EXISTS sessions_caisse_fermee_heure_fermeture_idx
  ON public.sessions_caisse (heure_fermeture DESC)
  WHERE statut = 'fermee' AND heure_fermeture IS NOT NULL;

-- Une seule caisse ouverte à la fois
CREATE UNIQUE INDEX IF NOT EXISTS sessions_caisse_one_ouverte
  ON public.sessions_caisse (statut)
  WHERE statut = 'ouverte';

COMMENT ON TABLE public.sessions_caisse IS 'Cycle caisse : fond hérité, ventes espèces, comptage physique, écart, détail comptage';
COMMENT ON COLUMN public.sessions_caisse.fond_initial IS 'Fond matin (hérité du total_declare de la veille, ou 100€ au premier jour)';
COMMENT ON COLUMN public.sessions_caisse.ventes_especes IS 'Somme des encaissements espèces (dont part mixte) sur la période';
COMMENT ON COLUMN public.sessions_caisse.total_declare IS 'Comptage physique billets/pièces à la clôture (trésorerie comptée)';
COMMENT ON COLUMN public.sessions_caisse.ecart IS 'total_declare - (fond_initial + ventes_especes)';
COMMENT ON COLUMN public.sessions_caisse.details_comptage IS 'Quantités par coupure, ex. {"100":2,"0.5":3}';

ALTER TABLE public.sessions_caisse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_caisse_select_authenticated" ON public.sessions_caisse;
DROP POLICY IF EXISTS "sessions_caisse_insert_authenticated" ON public.sessions_caisse;
DROP POLICY IF EXISTS "sessions_caisse_update_authenticated" ON public.sessions_caisse;
DROP POLICY IF EXISTS "sessions_caisse_delete_authenticated" ON public.sessions_caisse;

CREATE POLICY "sessions_caisse_select_authenticated"
  ON public.sessions_caisse FOR SELECT TO authenticated USING (true);

CREATE POLICY "sessions_caisse_insert_authenticated"
  ON public.sessions_caisse FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sessions_caisse_update_authenticated"
  ON public.sessions_caisse FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sessions_caisse_delete_authenticated"
  ON public.sessions_caisse FOR DELETE TO authenticated USING (true);
