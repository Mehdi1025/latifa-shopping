-- Colonnes CRM sur clients + ligne libellée pour lots (Coffre Noir) + produit technique

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS segment_rfm TEXT,
  ADD COLUMN IF NOT EXISTS total_depense NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.clients.segment_rfm IS 'VIP | Endormi | Régulier — alimenté par job / trigger métier';
COMMENT ON COLUMN public.clients.total_depense IS 'LTV agrégée (optionnel, peut être synchronisée depuis ventes)';

ALTER TABLE public.ventes_items
  ADD COLUMN IF NOT EXISTS libelle_ligne TEXT;

COMMENT ON COLUMN public.ventes_items.libelle_ligne IS 'Libellé affiché si différent du nom catalogue (ex. lot Coffre Noir)';

-- Produit technique pour les lots promotionnels (15 €, stock large)
INSERT INTO public.produits (id, nom, description, prix, stock, categorie)
SELECT
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Coffre Noir — lot',
  'Lot promotionnel Coffre Noir (libellé personnalisé en caisse)',
  15,
  9999,
  'Promotion'
WHERE NOT EXISTS (
  SELECT 1 FROM public.produits WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid
);
