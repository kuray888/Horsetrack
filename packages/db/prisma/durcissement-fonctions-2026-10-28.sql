-- Durcissement du 2026-10-28 — à exécuter UNE fois dans l'éditeur SQL
-- Supabase (prod). Idempotent, sans effet sur l'app.
--
-- Les fonctions « security definer » ci-dessous servent aux règles RLS. Par
-- défaut, Postgres et Supabase les rendent aussi appelables par un visiteur
-- non connecté (rôle anon, via /rest/v1/rpc/…) : avec l'identifiant d'un
-- cheval ou d'un profil, il apprendrait si son propriétaire est Premium et
-- combien de chevaux il peut avoir. Seuls les comptes connectés (règles RLS)
-- et l'API (service_role) en ont besoin.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.owns_horse(text)',
    'public.owns_rider_profile(text)',
    'public.horse_limit_for_rider(text)',
    'public.rider_is_active_or_trialing(text)',
    'public.horse_owner_is_active_or_trialing(text)',
    'public.effective_horse_limit(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Vérification : doit renvoyer 0 ligne.
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and pg_get_function_result(p.oid) <> 'trigger'
  and has_function_privilege('anon', p.oid, 'execute');
