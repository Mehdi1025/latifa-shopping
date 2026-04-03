-- Realtime : tables écoutées par le client (alertes, rafraîchissements)
-- Publication standard Supabase : supabase_realtime

do $$
declare
  t text;
  tables text[] := array[
    'ventes',
    'taches',
    'produits',
    'daily_traffic',
    'objectifs_journaliers'
  ];
begin
  foreach t in array tables
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end $$;
