-- CRM : clients et liaison aux ventes pour analyse RFM
-- Appliquez avec : supabase db push / migration locale

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ventes_client_id_idx ON public.ventes (client_id);

COMMENT ON TABLE public.clients IS 'Clients boutique — ventes.client_id pour RFM / CRM';
