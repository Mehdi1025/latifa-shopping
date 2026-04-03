-- Moyen d'encaissement (caisse vendeuse)
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS methode_paiement text;

ALTER TABLE public.ventes DROP CONSTRAINT IF EXISTS ventes_methode_paiement_check;

ALTER TABLE public.ventes
  ADD CONSTRAINT ventes_methode_paiement_check CHECK (
    methode_paiement IS NULL
    OR methode_paiement IN ('carte', 'especes', 'paypal')
  );

COMMENT ON COLUMN public.ventes.methode_paiement IS 'Encaissement : carte | especes | paypal';
