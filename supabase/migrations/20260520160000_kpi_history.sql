-- Historique KPI importé depuis CSV / Excel (archives)

CREATE TABLE IF NOT EXISTS public.historical_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  revenue numeric(14, 2) NOT NULL CHECK (revenue >= 0),
  sales_count integer NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
  average_basket numeric(14, 2) NOT NULL DEFAULT 0 CHECK (average_basket >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historical_kpis_date_unique UNIQUE (date)
);

CREATE INDEX IF NOT EXISTS historical_kpis_date_idx
  ON public.historical_kpis (date DESC);

COMMENT ON TABLE public.historical_kpis IS 'Archives KPI journalières importées (CSV/Excel).';
COMMENT ON COLUMN public.historical_kpis.revenue IS 'Chiffre d''affaires du jour (EUR).';
COMMENT ON COLUMN public.historical_kpis.sales_count IS 'Nombre de ventes estimé ou importé.';
COMMENT ON COLUMN public.historical_kpis.average_basket IS 'Panier moyen du jour (EUR).';

ALTER TABLE public.historical_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historical_kpis_select_admin" ON public.historical_kpis;
DROP POLICY IF EXISTS "historical_kpis_insert_admin" ON public.historical_kpis;
DROP POLICY IF EXISTS "historical_kpis_update_admin" ON public.historical_kpis;

CREATE POLICY "historical_kpis_select_admin"
  ON public.historical_kpis
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

CREATE POLICY "historical_kpis_insert_admin"
  ON public.historical_kpis
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

CREATE POLICY "historical_kpis_update_admin"
  ON public.historical_kpis
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );
