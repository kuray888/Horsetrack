-- Aucune fonction « security definer » (hors déclencheurs) n'est appelable par
-- un visiteur non connecté : avec un identifiant de cheval ou de profil, il
-- apprendrait le statut d'abonnement ou la composition d'une équipe.
insert into t.results (ok, label, detail)
select count(*) = 0, 'Anonyme : aucune fonction security definer', string_agg(p.proname, ', ')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and pg_get_function_result(p.oid) <> 'trigger'
  and has_function_privilege('anon', p.oid, 'execute');

-- Chaque fonction security definer fixe son search_path (sinon un objet
-- homonyme créé ailleurs pourrait être appelé avec ses droits).
insert into t.results (ok, label, detail)
select count(*) = 0, 'security definer : search_path fixé', string_agg(p.proname, ', ')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

-- Toutes les tables du schéma public sont sous RLS.
insert into t.results (ok, label, detail)
select count(*) = 0, 'Toutes les tables sous RLS', string_agg(tablename, ', ')
from pg_tables where schemaname = 'public' and not rowsecurity;
