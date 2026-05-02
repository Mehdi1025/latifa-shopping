-- Magasin de l’ombre : montants et reconstitution des paniers annulés.

ALTER TABLE public.logs_activite
  ADD COLUMN IF NOT EXISTS valeur_perdue NUMERIC(12, 2) DEFAULT NULL;

ALTER TABLE public.logs_activite
  ADD COLUMN IF NOT EXISTS shadow_manifest JSONB DEFAULT NULL;

COMMENT ON COLUMN public.logs_activite.valeur_perdue IS
  'Valeur TTC (€) associée à une suppression / annulation (ligne, unité ou panier vidé).';

COMMENT ON COLUMN public.logs_activite.shadow_manifest IS
  'JSON { total_ttc, lignes: [{ nom, qty, prix_unitaire, sous_total }] } pour annulation_vente (panier vidé).';
