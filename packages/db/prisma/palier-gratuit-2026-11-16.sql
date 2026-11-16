-- Palier gratuit resserré (2026-11-16) — à exécuter dans l'éditeur SQL
-- Supabase (prod) AVANT de mettre en circulation le build 1.3.0 qui
-- l'annonce. Idempotent, sans effet sur les données existantes ; ne vise que
-- les comptes gratuits créés à partir du 2026-11-20. Recopie la section
-- objectifs-gratuits de rls.sql (vérifié par test:rls).

-- >>> objectifs-gratuits (2026-11-16)
-- Palier gratuit resserré (1.3.0) : un compte GRATUIT créé à partir du
-- 2026-11-20 n'a qu'un objectif à la fois. Les comptes plus anciens, Premium
-- (actif ou essai) et les objectifs déjà présents ne sont jamais touchés :
-- seule la création d'un nouvel objectif est refusée. La date doit rester
-- celle de FREE_TIER_V2_SINCE (apps/mobile/src/subscription/freeTier.ts).
create or replace function public.rider_free_tier_restricted(_rider_profile_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select not public.rider_is_active_or_trialing(rp.id)
        and u.created_at >= timestamptz '2026-11-20 00:00:00+00'
      from public.rider_profiles rp
      join auth.users u on u.id::text = rp."userId"
      where rp.id = _rider_profile_id
    ),
    false
  );
$$;
revoke execute on function public.rider_free_tier_restricted(text) from public, anon;
grant execute on function public.rider_free_tier_restricted(text) to authenticated, service_role;

create or replace function public.enforce_free_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Un upsert d'un objectif existant passe aussi par BEFORE INSERT : le
  -- modifier reste toujours permis.
  if exists (select 1 from public.goals g where g.id = new.id) then
    return new;
  end if;
  if public.rider_free_tier_restricted(new."riderId")
    and (select count(*) from public.goals g where g."riderId" = new."riderId") >= 1 then
    raise exception 'free_goal_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists goals_free_limit on public.goals;
create trigger goals_free_limit
  before insert on public.goals
  for each row execute function public.enforce_free_goal_limit();
-- <<< objectifs-gratuits
