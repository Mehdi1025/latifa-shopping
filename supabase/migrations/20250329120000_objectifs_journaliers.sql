-- Planification quotidienne des objectifs (pilotage admin → vendeuses)
create table if not exists public.objectifs_journaliers (
  jour date primary key,
  montant_cible numeric(12, 2) not null default 1000,
  taux_conversion numeric(5, 2),
  note_du_jour text,
  updated_at timestamptz not null default now()
);

-- Si la table existait déjà (créée à la main ou ancienne version) sans colonne `jour`,
-- `CREATE TABLE IF NOT EXISTS` ne fait rien et l’index ci-dessous échoue (42703).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
      and column_name = 'jour'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'objectifs_journaliers'
        and column_name = 'date'
    ) then
      alter table public.objectifs_journaliers rename column date to jour;
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'objectifs_journaliers'
        and column_name = 'jour_date'
    ) then
      alter table public.objectifs_journaliers rename column jour_date to jour;
    end if;
  end if;
end $$;

create index if not exists objectifs_journaliers_jour_idx on public.objectifs_journaliers (jour desc);

alter table public.objectifs_journaliers enable row level security;

-- Toute personne connectée peut lire (vendeuses + admin)
create policy "objectifs_journaliers_select_authenticated"
  on public.objectifs_journaliers
  for select
  to authenticated
  using (true);

-- Écriture réservée aux admins
create policy "objectifs_journaliers_insert_admin"
  on public.objectifs_journaliers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

create policy "objectifs_journaliers_update_admin"
  on public.objectifs_journaliers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

create policy "objectifs_journaliers_delete_admin"
  on public.objectifs_journaliers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

comment on table public.objectifs_journaliers is 'Objectifs CA / conversion et note du jour par date (pilotage Latifa).';
