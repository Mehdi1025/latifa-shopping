-- `upsert(..., { onConflict: "code_barre" })` (PostgREST) nécessite une contrainte
-- UNIQUE sur la colonne. Un index unique *partiel* n’est pas pris en charge pour
-- ON CONFLICT (code_barre) → erreur "no unique or exclusion constraint...".

drop index if exists public.produits_code_barre_unique;

alter table public.produits
  drop constraint if exists produits_code_barre_key;

-- Plusieurs NULL autorisés (comportement PostgreSQL sur UNIQUE).
alter table public.produits
  add constraint produits_code_barre_key unique (code_barre);

comment on constraint produits_code_barre_key on public.produits is
  'Unicité EAN-13 pour upsert / import. Plusieurs NULL possibles.';
