-- Flux boutique : entrées comptabilisées par jour (une ligne / jour calendaire local côté app)
create table if not exists public.daily_traffic (
  jour date primary key,
  nombre_entrees integer not null default 0 check (nombre_entrees >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists daily_traffic_jour_idx on public.daily_traffic (jour desc);

alter table public.daily_traffic enable row level security;

create policy "daily_traffic_select_authenticated"
  on public.daily_traffic
  for select
  to authenticated
  using (true);

create policy "daily_traffic_insert_authenticated"
  on public.daily_traffic
  for insert
  to authenticated
  with check (true);

create policy "daily_traffic_update_authenticated"
  on public.daily_traffic
  for update
  to authenticated
  using (true)
  with check (true);

comment on table public.daily_traffic is 'Nombre d''entrées en boutique par jour (compteur vendeuse).';
