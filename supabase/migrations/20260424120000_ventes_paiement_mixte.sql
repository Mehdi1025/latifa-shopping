-- Paiement mixte (espèces + carte) + ventilation optionnelle
ALTER TABLE public.ventes DROP CONSTRAINT IF EXISTS ventes_methode_paiement_check;

ALTER TABLE public.ventes
  ADD CONSTRAINT ventes_methode_paiement_check CHECK (
    methode_paiement IS NULL
    OR methode_paiement IN ('carte', 'especes', 'paypal', 'mixte')
  );

ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS montant_especes numeric;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS montant_carte numeric;

COMMENT ON COLUMN public.ventes.methode_paiement IS 'Encaissement : carte | especes | paypal | mixte';
COMMENT ON COLUMN public.ventes.montant_especes IS 'Part espèces (notamment si methode_paiement = mixte)';
COMMENT ON COLUMN public.ventes.montant_carte IS 'Part carte / TPE (notamment si methode_paiement = mixte)';
