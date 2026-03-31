-- Compat montant : anciennes bases peuvent avoir `objectif_journalier` au lieu de `montant_cible`,
-- ou des outils qui attendent encore `objectif_journalier` alors que seul `montant_cible` existe.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
  ) then
    return;
  end if;

  -- 1) Unifier vers le nom canonique utilisé par l’app : montant_cible
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
      and column_name = 'objectif_journalier'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
      and column_name = 'montant_cible'
  ) then
    alter table public.objectifs_journaliers
      rename column objectif_journalier to montant_cible;
  end if;
end $$;

-- 2) Exposer objectif_journalier comme copie de montant_cible (lecture / anciens clients)
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
  ) then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
      and column_name = 'montant_cible'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'objectifs_journaliers'
      and column_name = 'objectif_journalier'
  ) then
    alter table public.objectifs_journaliers
      add column objectif_journalier numeric(12, 2)
      generated always as (montant_cible) stored;
  end if;
end $$;
