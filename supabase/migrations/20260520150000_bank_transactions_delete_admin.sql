-- Autoriser les admins à remplacer l'import CSV (wipe avant insert)

DROP POLICY IF EXISTS "bank_transactions_delete_admin" ON public.bank_transactions;

CREATE POLICY "bank_transactions_delete_admin"
  ON public.bank_transactions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );
