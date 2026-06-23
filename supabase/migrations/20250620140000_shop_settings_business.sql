-- Paramètres métier boutique : charges fixes et objectifs mensuels (singleton id=1).

ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS charges_fixes_mensuelles numeric NOT NULL DEFAULT 3500,
  ADD COLUMN IF NOT EXISTS objectif_ca_mensuel numeric NOT NULL DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS objectif_commandes_mensuel integer NOT NULL DEFAULT 400;

COMMENT ON COLUMN public.shop_settings.charges_fixes_mensuelles IS
  'Charges fixes mensuelles (loyer, salaires, etc.) — runway KPI.';
COMMENT ON COLUMN public.shop_settings.objectif_ca_mensuel IS
  'Objectif chiffre d''affaires mensuel (€).';
COMMENT ON COLUMN public.shop_settings.objectif_commandes_mensuel IS
  'Objectif nombre de ventes / commandes par mois.';

UPDATE public.shop_settings
SET
  charges_fixes_mensuelles = COALESCE(charges_fixes_mensuelles, 3500),
  objectif_ca_mensuel = COALESCE(objectif_ca_mensuel, 15000),
  objectif_commandes_mensuel = COALESCE(objectif_commandes_mensuel, 400),
  updated_at = now()
WHERE id = 1;

INSERT INTO public.shop_settings (
  id,
  charges_fixes_mensuelles,
  objectif_ca_mensuel,
  objectif_commandes_mensuel
)
VALUES (1, 3500, 15000, 400)
ON CONFLICT (id) DO NOTHING;

-- Mise à jour réservée aux admins (lecture ouverte aux authentifiés pour KPI / caisse).
DROP POLICY IF EXISTS "shop_settings_update_authenticated" ON public.shop_settings;
DROP POLICY IF EXISTS "shop_settings_update_admin" ON public.shop_settings;

CREATE POLICY "shop_settings_update_admin"
  ON public.shop_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );
