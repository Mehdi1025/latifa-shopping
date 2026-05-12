-- Paramètres boutique (singleton) : lien Bridge item après Connect

CREATE TABLE IF NOT EXISTS public.shop_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  CONSTRAINT shop_settings_singleton CHECK (id = 1),
  bridge_item_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.shop_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.shop_settings IS 'Configuration boutique (une seule ligne id=1).';
COMMENT ON COLUMN public.shop_settings.bridge_item_id IS 'Dernier item Bridge Connect (Open Banking).';

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_settings_select_authenticated" ON public.shop_settings;
DROP POLICY IF EXISTS "shop_settings_insert_authenticated" ON public.shop_settings;
DROP POLICY IF EXISTS "shop_settings_update_authenticated" ON public.shop_settings;

CREATE POLICY "shop_settings_select_authenticated"
  ON public.shop_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "shop_settings_insert_authenticated"
  ON public.shop_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "shop_settings_update_authenticated"
  ON public.shop_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
