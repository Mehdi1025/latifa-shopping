-- Alignement schéma bank_transactions avec l'import CSV (colonne description)
-- Corrige les bases créées via 20260329120000_bank_transactions (colonne label).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_transactions'
      AND column_name = 'label'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_transactions'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.bank_transactions RENAME COLUMN label TO description;
  END IF;
END $$;

COMMENT ON COLUMN public.bank_transactions.description IS
  'Libellé de l''opération bancaire (import CSV / Open Banking).';

-- Remplacer les anciennes politiques permissives par un accès admin strict
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_transactions_select_authenticated" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_insert_authenticated" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_update_authenticated" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_delete_authenticated" ON public.bank_transactions;

DROP POLICY IF EXISTS "bank_transactions_select_admin" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_insert_admin" ON public.bank_transactions;

CREATE POLICY "bank_transactions_select_admin"
  ON public.bank_transactions
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

CREATE POLICY "bank_transactions_insert_admin"
  ON public.bank_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );
