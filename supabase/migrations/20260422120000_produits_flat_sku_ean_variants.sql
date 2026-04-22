-- Variantes “flat SKU” : EAN-13 (texte, zéro de tête conservé) + taille + couleur
alter table public.produits
  add column if not exists code_barre text,
  add column if not exists taille text,
  add column if not exists couleur text;

comment on column public.produits.code_barre is 'EAN-13 unique par variante (texte, ne pas convertir en nombre).';
comment on column public.produits.taille is 'Taille (ex. T.60) — flat SKU';
comment on column public.produits.couleur is 'Couleur — flat SKU';

-- Unicité sur les EAN non nuls (plusieurs NULL autorisés pour l’existant)
create unique index if not exists produits_code_barre_unique
  on public.produits (code_barre)
  where code_barre is not null and btrim(code_barre) <> '';

create index if not exists produits_taille_idx on public.produits (taille);
create index if not exists produits_couleur_idx on public.produits (couleur);
