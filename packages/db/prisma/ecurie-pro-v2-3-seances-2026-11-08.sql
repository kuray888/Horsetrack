-- Écurie Pro v2, étape 3 (2026-11-08) — à exécuter APRÈS les étapes 1 et 2,
-- dans l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql
-- (section « planning-seances ») : tests/rls/run.sh vérifie qu'elles
-- restent identiques.
--
-- Séance attribuée à un cavalier, « C'est fait » coché par celui qui a monté.

alter table public.training_sessions add column if not exists "riderUserId" text;
alter table public.training_sessions add column if not exists "riderName" text;
alter table public.training_sessions add column if not exists "doneByUserId" text;
alter table public.training_sessions add column if not exists "doneAt" timestamp(3);
alter table public.training_sessions add column if not exists feeling text;
create index if not exists "training_sessions_riderUserId_idx" on public.training_sessions ("riderUserId");

-- >>> planning-seances (Écurie Pro v2, 2026-11-08)
-- Séance attribuée à un cavalier (compte de l'équipe, ou simple nom sans
-- compte) et « C'est fait » coché par celui qui a monté. Le cavalier
-- attribué peut cocher sa séance, noter son ressenti et sa durée — rien
-- d'autre : le reste de la ligne garde la version du serveur, même si son
-- téléphone renvoie une copie ancienne (synchronisation hors ligne).
-- Qui a coché et quand : posés par la base, jamais par l'app.

-- Équipe d'un cheval : propriétaire et collaborateurs acceptés, avec un nom
-- affichable (prénom saisi, sinon début de l'adresse). Réservée à ceux qui
-- ont accès au cheval.
create or replace function public.horse_team(_horse_id text)
returns table ("userId" text, name text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1)), 'OWNER'
  from public.horses h
  join public.rider_profiles rp on rp.id = h."ownerId"
  join public.users u on u.id = rp."userId"
  where h.id = _horse_id and public.can_access_horse(_horse_id)
  union all
  select u.id, coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1)), hc.role::text
  from public.horse_collaborators hc
  join public.users u on u.id = hc."collaboratorUserId"
  where hc."horseId" = _horse_id and hc.status = 'ACCEPTED' and public.can_access_horse(_horse_id);
$$;

revoke execute on function public.horse_team(text) from public, anon;
grant execute on function public.horse_team(text) to authenticated, service_role;

-- Un compte de l'équipe du cheval (propriétaire ou collaborateur accepté).
create or replace function public.is_horse_member(_horse_id text, _user_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.horses h
    join public.rider_profiles rp on rp.id = h."ownerId"
    where h.id = _horse_id and rp."userId" = _user_id
  ) or exists (
    select 1 from public.horse_collaborators hc
    where hc."horseId" = _horse_id and hc."collaboratorUserId" = _user_id and hc.status = 'ACCEPTED'
  );
$$;

revoke execute on function public.is_horse_member(text, text) from public, anon;
grant execute on function public.is_horse_member(text, text) to authenticated, service_role;

create or replace function public.training_session_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _completed boolean;
  _feeling text;
  _duration integer;
  _updated timestamp(3);
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Cavalier attribué sans droit d'écriture sur la séance : seuls « fait »,
  -- ressenti, durée et date de mise à jour passent.
  if tg_op = 'UPDATE' and not public.can_write_session(old."horseId", old."createdByUserId") then
    _completed := new.completed;
    _feeling := new.feeling;
    _duration := new."durationMinutes";
    _updated := new."updatedAt";
    new := old;
    new.completed := _completed;
    new.feeling := _feeling;
    new."durationMinutes" := _duration;
    new."updatedAt" := _updated;
  end if;

  -- Cavalier attribué : quelqu'un de l'équipe du cheval ; sans droit sur
  -- toutes les séances, seulement soi-même.
  if new."riderUserId" is not null
     and (tg_op = 'INSERT' or new."riderUserId" is distinct from old."riderUserId") then
    if not public.is_horse_member(new."horseId", new."riderUserId") then
      raise exception 'training session: rider is not part of this horse''s team';
    end if;
    if new."riderUserId" <> auth.uid()::text and not public.horse_can(new."horseId", 'manage_sessions') then
      raise exception 'training session: only the coach, manager or owner assign someone else';
    end if;
  end if;

  -- Qui a coché « C'est fait », et quand.
  if new.completed and (tg_op = 'INSERT' or not old.completed) then
    new."doneByUserId" := auth.uid()::text;
    new."doneAt" := now();
  elsif not new.completed then
    new."doneByUserId" := null;
    new."doneAt" := null;
  else
    new."doneByUserId" := old."doneByUserId";
    new."doneAt" := old."doneAt";
  end if;
  return new;
end;
$$;

drop trigger if exists training_session_rules on public.training_sessions;
create trigger training_session_rules
  before insert or update on public.training_sessions
  for each row execute function public.training_session_rules();

-- Séance : écrite par son auteur ou le coach / gérant / propriétaire (cf.
-- droits-par-role), et cochée par son cavalier attribué.
create or replace function public.can_update_session(_horse_id text, _created_by text, _rider text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_write_session(_horse_id, _created_by)
    or coalesce(_rider = auth.uid()::text and public.can_access_horse(_horse_id), false);
$$;

revoke execute on function public.can_update_session(text, text, text) from public, anon;
grant execute on function public.can_update_session(text, text, text) to authenticated, service_role;

drop policy if exists "training_sessions_update_shared" on public.training_sessions;
create policy "training_sessions_update_shared" on public.training_sessions
  for update using (public.can_update_session("horseId", "createdByUserId", "riderUserId"))
  with check (public.can_update_session("horseId", "createdByUserId", "riderUserId"));

-- Parcours GPS : aussi celui du cavalier attribué (séance en direct).
create or replace function public.can_write_session_ride(_session_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.can_update_session(s."horseId", s."createdByUserId", s."riderUserId")
       from public.training_sessions s where s.id = _session_id),
    false
  );
$$;
-- <<< planning-seances
