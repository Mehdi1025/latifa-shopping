-- E-mail client (ticket post-vente) + trace d'envoi sur la vente.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS clients_email_idx ON public.clients (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

COMMENT ON COLUMN public.clients.email IS 'E-mail optionnel pour envoi du ticket de caisse.';

ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS ticket_email_envoye_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ventes.ticket_email_envoye_at IS 'Horodatage du dernier envoi e-mail du ticket client.';
