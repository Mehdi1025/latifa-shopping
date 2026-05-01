-- Prélèvement (enveloppe) et fond laissé pour le lendemain à la clôture.
-- fond_initial du matin doit correspondre au fond_laisse de la dernière fermeture.

DO $migration$
BEGIN
  IF to_regclass('public.sessions_caisse') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'fond_laisse'
  ) THEN
    ALTER TABLE public.sessions_caisse
      ADD COLUMN fond_laisse numeric(14, 2) CHECK (fond_laisse IS NULL OR fond_laisse >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions_caisse' AND column_name = 'montant_preleve'
  ) THEN
    ALTER TABLE public.sessions_caisse
      ADD COLUMN montant_preleve numeric(14, 2) CHECK (montant_preleve IS NULL OR montant_preleve >= 0);
  END IF;
END
$migration$;

COMMENT ON COLUMN public.sessions_caisse.fond_laisse IS
  'Espèces laissées dans le tiroir pour la session suivante (fond_initial du lendemain)';
COMMENT ON COLUMN public.sessions_caisse.montant_preleve IS
  'Prélèvement banque / enveloppe à la clôture : total_declare (comptage tiroir) − fond_laisse';
COMMENT ON COLUMN public.sessions_caisse.fond_initial IS
  'Fond matin : égal au fond_laisse de la dernière session fermée, ou 100 € au premier jour';
