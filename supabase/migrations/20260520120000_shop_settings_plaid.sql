-- Migration Bridge → Plaid : stockage item et access token côté serveur

ALTER TABLE public.shop_settings
  RENAME COLUMN bridge_item_id TO plaid_item_id;

ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS plaid_access_token text;

COMMENT ON COLUMN public.shop_settings.plaid_item_id IS 'Plaid Item ID après Link (Open Banking).';
COMMENT ON COLUMN public.shop_settings.plaid_access_token IS 'Plaid access token (usage serveur uniquement).';
