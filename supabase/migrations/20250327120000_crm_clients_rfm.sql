-- CRM : clients et liaison aux ventes pour analyse RFM
-- Aligné sur supabase/sql/setup_clients_crm.sql (id, nom, telephone, created_at)

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_telephone_idx ON public.clients (telephone);

ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ventes_client_id_idx ON public.ventes (client_id);

COMMENT ON TABLE public.clients IS 'Clients boutique — ventes.client_id pour RFM / CRM';
