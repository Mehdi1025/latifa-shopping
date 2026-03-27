-- =============================================================================
-- CRM Clients — à exécuter dans Supabase → SQL Editor (une seule fois)
-- =============================================================================

-- 1) Table clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_telephone_idx ON public.clients (telephone);

COMMENT ON TABLE public.clients IS 'Clients boutique — liés aux ventes via ventes.client_id';

-- 2) Colonne ventes.client_id (nullable) + clé étrangère
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ventes_client_id_fkey'
  ) THEN
    ALTER TABLE public.ventes
      ADD CONSTRAINT ventes_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ventes_client_id_idx ON public.ventes (client_id);

-- 3) RLS (optionnel — adaptez si vous utilisez déjà des politiques strictes)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients_update_authenticated" ON public.clients;

CREATE POLICY "clients_select_authenticated"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "clients_insert_authenticated"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "clients_update_authenticated"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
