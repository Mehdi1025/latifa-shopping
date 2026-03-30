-- Open Banking : mouvements bancaires pour la trésorerie réelle (dashboard admin)

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_transactions_date_idx
  ON public.bank_transactions (date DESC);

CREATE INDEX IF NOT EXISTS bank_transactions_created_at_idx
  ON public.bank_transactions (created_at DESC);

COMMENT ON TABLE public.bank_transactions IS 'Transactions bancaires importées (Open Banking / manuel)';
COMMENT ON COLUMN public.bank_transactions.amount IS 'Montant toujours positif ; le sens est donné par type (income/expense).';

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_transactions_select_authenticated" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_insert_authenticated" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_update_authenticated" ON public.bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_delete_authenticated" ON public.bank_transactions;

-- Politique large : tout utilisateur connecté (à restreindre au rôle admin si besoin)
CREATE POLICY "bank_transactions_select_authenticated"
  ON public.bank_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_transactions_insert_authenticated"
  ON public.bank_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "bank_transactions_update_authenticated"
  ON public.bank_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "bank_transactions_delete_authenticated"
  ON public.bank_transactions FOR DELETE TO authenticated USING (true);
