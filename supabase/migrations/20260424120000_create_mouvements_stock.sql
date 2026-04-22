-- Journal des mouvements de stock (traçabilité)
create table if not exists public.mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produits (id) on delete cascade,
  quantite integer not null,
  type_mouvement text not null
    check (type_mouvement in ('VENTE', 'RECEPTION', 'RETOUR', 'INVENTAIRE')),
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists mouvements_stock_produit_id_idx
  on public.mouvements_stock (produit_id, created_at desc);

comment on table public.mouvements_stock is
  'Traçabilité : chaque ajout / retrait de stock (vente, réception, retour, inventaire).';

alter table public.mouvements_stock enable row level security;

create policy "mouvements_stock_select_authenticated"
  on public.mouvements_stock
  for select
  to authenticated
  using (true);

create policy "mouvements_stock_insert_authenticated"
  on public.mouvements_stock
  for insert
  to authenticated
  with check (true);
