-- Sessions d'ouverture / fermeture de caisse (Z-read / clôture)

CREATE TABLE IF NOT EXISTS public.sessions_caisse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heure_ouverture timestamptz NOT NULL,
  heure_fermeture timestamptz,
  fond_de_caisse numeric(14, 2) NOT NULL CHECK (fond_de_caisse >= 0),
  total_ventes_especes numeric(14, 2) NOT NULL DEFAULT 0,
  total_declare_especes numeric(14, 2),
  ecart numeric(14, 2),
  statut text NOT NULL CHECK (statut IN ('ouverte', 'fermee'))
);

CREATE INDEX IF NOT EXISTS sessions_caisse_statut_idx
  ON public.sessions_caisse (statut);

CREATE INDEX IF NOT EXISTS sessions_caisse_heure_ouverture_idx
  ON public.sessions_caisse (heure_ouverture DESC);

-- Une seule caisse ouverte à la fois
CREATE UNIQUE INDEX IF NOT EXISTS sessions_caisse_one_ouverte
  ON public.sessions_caisse (statut)
  WHERE statut = 'ouverte';

COMMENT ON TABLE public.sessions_caisse IS 'Ouverture / clôture de caisse POS (fond, comptage, écart Z)';
COMMENT ON COLUMN public.sessions_caisse.fond_de_caisse IS 'Fond au démarrage (matin)';
COMMENT ON COLUMN public.sessions_caisse.total_ventes_especes IS 'Total encaissé en espèces (et part espèces des ventes mixtes) sur la période';
COMMENT ON COLUMN public.sessions_caisse.total_declare_especes IS 'Comptage physique (billets/pièces) à la clôture';
COMMENT ON COLUMN public.sessions_caisse.ecart IS 'total_declare - (fond + total_ventes_especes)';

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
