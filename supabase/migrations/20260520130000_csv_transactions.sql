-- Import CSV bancaire : transactions stockées côté Supabase

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_transactions_date_idx
  ON public.bank_transactions (date DESC);

CREATE INDEX IF NOT EXISTS bank_transactions_created_at_idx
  ON public.bank_transactions (created_at DESC);

COMMENT ON TABLE public.bank_transactions IS 'Transactions bancaires importées manuellement (CSV).';
COMMENT ON COLUMN public.bank_transactions.amount IS 'Montant absolu en EUR.';
COMMENT ON COLUMN public.bank_transactions.type IS 'income = entrée, expense = sortie.';

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

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
