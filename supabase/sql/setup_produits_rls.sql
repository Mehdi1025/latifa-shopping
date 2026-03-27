-- =============================================================================
-- RLS table produits — lecture + mise à jour stock pour vendeuses & admin
-- Exécuter dans Supabase → SQL Editor (ajuster si vous avez déjà des politiques)
-- =============================================================================

ALTER TABLE public.produits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produits_select_authenticated" ON public.produits;
DROP POLICY IF EXISTS "produits_insert_authenticated" ON public.produits;
DROP POLICY IF EXISTS "produits_update_authenticated" ON public.produits;
DROP POLICY IF EXISTS "produits_delete_authenticated" ON public.produits;

-- Tout utilisateur authentifié (rôle vendeuse ou admin côté app) peut gérer le catalogue
CREATE POLICY "produits_select_authenticated"
  ON public.produits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "produits_insert_authenticated"
  ON public.produits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "produits_update_authenticated"
  ON public.produits FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Optionnel : interdire DELETE depuis l’app vendeuse (décommenter si besoin)
-- CREATE POLICY "produits_delete_authenticated"
--   ON public.produits FOR DELETE TO authenticated USING (false);

COMMENT ON TABLE public.produits IS 'Stock boutique — RLS: authentifiés peuvent SELECT/INSERT/UPDATE';
