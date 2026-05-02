-- Journal d'activité (audit caisse / POS) — consultable par les admins uniquement ;
-- tout utilisateur connecté peut enregistrer une ligne de log depuis l'appli vendeuse.

CREATE TABLE IF NOT EXISTS public.logs_activite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vendeur_nom VARCHAR(240),
  type_action VARCHAR(128) NOT NULL,
  details TEXT,
  niveau_alerte VARCHAR(16) NOT NULL DEFAULT 'info',
  CONSTRAINT logs_activite_niveau_check CHECK (
    lower(trim(niveau_alerte)) IN ('info', 'warning', 'critique')
  )
);

CREATE INDEX IF NOT EXISTS logs_activite_created_at_idx
  ON public.logs_activite (created_at DESC);

CREATE INDEX IF NOT EXISTS logs_activite_niveau_idx
  ON public.logs_activite (lower(trim(niveau_alerte)));

COMMENT ON TABLE public.logs_activite IS 'Traces métier POS / caisse (scan, suppression panier, etc.)';
COMMENT ON COLUMN public.logs_activite.vendeur_nom IS 'Nom affiché tel que connu dans l''app (profiles.full_name)';
COMMENT ON COLUMN public.logs_activite.type_action IS 'Clé fonctionnelle ex. scan, suppression_panier, ouverture_caisse';
COMMENT ON COLUMN public.logs_activite.details IS 'Description lisible pour l''administrateur';
COMMENT ON COLUMN public.logs_activite.niveau_alerte IS 'info | warning | critique';

ALTER TABLE public.logs_activite ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_activite_select_admin" ON public.logs_activite;
CREATE POLICY "logs_activite_select_admin"
  ON public.logs_activite
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

DROP POLICY IF EXISTS "logs_activite_insert_authenticated" ON public.logs_activite;
CREATE POLICY "logs_activite_insert_authenticated"
  ON public.logs_activite
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
