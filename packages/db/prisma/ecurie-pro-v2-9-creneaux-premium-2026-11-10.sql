-- Écurie Pro v2, étape 9 (2026-11-10) — à exécuter APRÈS l'étape 8, dans
-- l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql (section
-- « premium-creneaux ») : tests/rls/run.sh vérifie qu'elles restent identiques.
--
-- Créneaux récurrents ouverts à Premium (le propriétaire d'un abonnement actif
-- ou d'un essai). Personne ne perd de droit : un compte Pro est aussi Premium.

-- >>> premium-creneaux (2026-11-10)
-- Les créneaux récurrents s'ouvrent à Premium : le propriétaire d'un abonnement
-- actif (ou d'un essai) les écrit, Pro ou non ; son équipe garde ses droits par
-- rôle (manage_planning). Rétrocompatible : ceux qui écrivaient hier (Pro)
-- écrivent encore, un Pro est aussi Premium (rider_is_active_or_trialing). Les
-- tâches et les frais restent réservés à Écurie Pro.

create or replace function public.horse_owner_has_premium(_horse_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.horses h
    where h.id = _horse_id
      and public.rider_is_active_or_trialing(h."ownerId")
  );
$$;

revoke execute on function public.horse_owner_has_premium(text) from public, anon;
grant execute on function public.horse_owner_has_premium(text) to authenticated, service_role;

drop policy if exists "ride_slots_insert_planning" on public.ride_slots;
create policy "ride_slots_insert_planning" on public.ride_slots
  for insert with check (public.horse_can("horseId", 'manage_planning') and public.horse_owner_has_premium("horseId"));
drop policy if exists "ride_slots_update_planning" on public.ride_slots;
create policy "ride_slots_update_planning" on public.ride_slots
  for update using (public.horse_can("horseId", 'manage_planning') and public.horse_owner_has_premium("horseId"))
  with check (public.horse_can("horseId", 'manage_planning') and public.horse_owner_has_premium("horseId"));
drop policy if exists "ride_slots_delete_planning" on public.ride_slots;
create policy "ride_slots_delete_planning" on public.ride_slots
  for delete using (public.horse_can("horseId", 'manage_planning') and public.horse_owner_has_premium("horseId"));

create or replace function public.migrate_partnership_slots(_horse_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _p jsonb;
  _rider text;
  _name text;
  _count integer := 0;
  _day jsonb;
begin
  if auth.uid() is not null and not (public.owns_horse(_horse_id) and public.horse_owner_has_premium(_horse_id)) then
    raise exception 'migrate_partnership_slots: owner with an active subscription only';
  end if;
  select partnership into _p from public.horse_details where "horseId" = _horse_id;
  if _p is null or jsonb_typeof(_p -> 'days') <> 'array' or jsonb_array_length(_p -> 'days') = 0 then
    return 0;
  end if;
  select case when count(*) = 1 then min(hc."collaboratorUserId") end into _rider
  from public.horse_collaborators hc
  where hc."horseId" = _horse_id and hc.role = 'DEMI_PENSION' and hc.status = 'ACCEPTED';
  _name := nullif(trim(coalesce(_p ->> 'riderName', '')), '');
  for _day in select * from jsonb_array_elements(_p -> 'days') loop
    if jsonb_typeof(_day) = 'number' and (_day::text)::int between 1 and 7 then
      insert into public.ride_slots (id, "horseId", "riderUserId", "riderName", weekday, kind, notes, "validFrom", "createdByUserId", "updatedAt")
      values (
        'dp_' || _horse_id || '_' || (_day::text),
        _horse_id,
        _rider,
        case when _rider is null then _name end,
        (_day::text)::int,
        'DP',
        '',
        date_trunc('day', now()),
        coalesce(auth.uid()::text, (select rp."userId" from public.horses h join public.rider_profiles rp on rp.id = h."ownerId" where h.id = _horse_id)),
        now()
      )
      on conflict (id) do nothing;
      if found then _count := _count + 1; end if;
    end if;
  end loop;
  return _count;
end;
$$;

revoke execute on function public.migrate_partnership_slots(text) from public, anon;
grant execute on function public.migrate_partnership_slots(text) to authenticated, service_role;
-- <<< premium-creneaux
