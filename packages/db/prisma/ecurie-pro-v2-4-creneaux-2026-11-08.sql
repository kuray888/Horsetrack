-- Écurie Pro v2, étape 4 (2026-11-08) — à exécuter APRÈS les étapes 1 à 3,
-- dans l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql
-- (section « creneaux ») : tests/rls/run.sh vérifie qu'elles restent
-- identiques.
--
-- Créneaux récurrents, et jours de demi-pension des comptes Écurie Pro
-- transformés en créneaux (les autres le seront à l'ouverture de l'app).

create table if not exists public.ride_slots (
  id text primary key,
  "horseId" text not null references public.horses(id) on delete cascade on update cascade,
  "riderUserId" text,
  "riderName" text,
  weekday integer not null,
  "startTime" text,
  "endTime" text,
  "validFrom" timestamp(3) not null,
  "validUntil" timestamp(3),
  kind text not null default 'WORK',
  "activityType" public.activity_type,
  notes text not null default '',
  "createdByUserId" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);
create index if not exists "ride_slots_horseId_idx" on public.ride_slots ("horseId");
create index if not exists "ride_slots_riderUserId_idx" on public.ride_slots ("riderUserId");
grant all on public.ride_slots to authenticated, service_role;

alter table public.training_sessions add column if not exists "slotId" text;
alter table public.training_sessions add column if not exists "cancelledAt" timestamp(3);

-- >>> creneaux (Écurie Pro v2, 2026-11-08)
-- Créneaux récurrents par cheval et par cavalier (ex. demi-pension le mardi
-- et le jeudi, 18 h – 19 h 30). Ils ne créent pas de séances à l'avance :
-- l'app calcule les occurrences, et une séance n'est écrite que quand
-- quelqu'un agit dessus (faite, annulée, modifiée), avec l'identifiant
-- déterministe « <créneau>_<AAAA-MM-JJ> » — deux téléphones hors ligne
-- écrivent la même ligne, sans doublon. Écriture réservée à Écurie Pro
-- (coach, gérant, propriétaire) ; lecture pour toute l'équipe, y compris
-- après la fin de l'abonnement.

create or replace function public.horse_owner_is_pro(_horse_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.horses h
    join public.rider_profiles rp on rp.id = h."ownerId"
    where h.id = _horse_id
      and rp."subscriptionTier" = 'PRO'
      and public.rider_is_active_or_trialing(rp.id)
  );
$$;

revoke execute on function public.horse_owner_is_pro(text) from public, anon;
grant execute on function public.horse_owner_is_pro(text) to authenticated, service_role;

alter table public.ride_slots enable row level security;

drop policy if exists "ride_slots_select_shared" on public.ride_slots;
create policy "ride_slots_select_shared" on public.ride_slots
  for select using (public.can_access_horse("horseId"));
drop policy if exists "ride_slots_insert_planning" on public.ride_slots;
create policy "ride_slots_insert_planning" on public.ride_slots
  for insert with check (public.horse_can("horseId", 'manage_planning') and public.horse_owner_is_pro("horseId"));
drop policy if exists "ride_slots_update_planning" on public.ride_slots;
create policy "ride_slots_update_planning" on public.ride_slots
  for update using (public.horse_can("horseId", 'manage_planning') and public.horse_owner_is_pro("horseId"))
  with check (public.horse_can("horseId", 'manage_planning') and public.horse_owner_is_pro("horseId"));
drop policy if exists "ride_slots_delete_planning" on public.ride_slots;
create policy "ride_slots_delete_planning" on public.ride_slots
  for delete using (public.horse_can("horseId", 'manage_planning') and public.horse_owner_is_pro("horseId"));

drop trigger if exists set_created_by on public.ride_slots;
create trigger set_created_by before insert or update on public.ride_slots
  for each row execute function public.set_created_by();

-- Cavalier d'un créneau : quelqu'un de l'équipe du cheval ; jours 1 à 7.
create or replace function public.ride_slot_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.weekday < 1 or new.weekday > 7 then
    raise exception 'ride slot: weekday must be 1 (Monday) to 7 (Sunday)';
  end if;
  if new."riderUserId" is not null and not public.is_horse_member(new."horseId", new."riderUserId") then
    raise exception 'ride slot: rider is not part of this horse''s team';
  end if;
  return new;
end;
$$;

drop trigger if exists ride_slot_rules on public.ride_slots;
create trigger ride_slot_rules
  before insert or update on public.ride_slots
  for each row execute function public.ride_slot_rules();

-- Jours de demi-pension (texte de la fiche, horse_details.partnership) →
-- créneaux. Un créneau par jour, identifiant déterministe : rejouable sans
-- doublon. Rattaché au compte de la demi-pension s'il n'y en a qu'une
-- acceptée sur le cheval, sinon au prénom saisi. Le texte reste (les
-- versions 1.1 le lisent encore). Appelable par le propriétaire en Pro, ou
-- par le backend (migration) ; renvoie le nombre de créneaux créés.
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
  if auth.uid() is not null and not (public.owns_horse(_horse_id) and public.horse_owner_is_pro(_horse_id)) then
    raise exception 'migrate_partnership_slots: owner with Écurie Pro only';
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
-- <<< creneaux

-- Jours de demi-pension des chevaux dont le propriétaire est en Écurie Pro.
select h.id, public.migrate_partnership_slots(h.id) as "créneaux créés"
from public.horses h
where public.horse_owner_is_pro(h.id);
