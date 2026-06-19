-- ============================================================================
-- À exécuter APRÈS `pnpm db:push` (les tables doivent déjà exister).
-- Idempotent : peut être relancé sans risque.
-- Colonnes en camelCase entre guillemets : ce sont les noms de colonnes réels
-- générés par Prisma (pas de @map sur les champs scalaires dans schema.prisma).
-- ============================================================================

-- 1. Lier public.users à auth.users (id == auth.uid()) ----------------------

alter table public.users
  drop constraint if exists users_id_fkey;
alter table public.users
  add constraint users_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- 2. Création automatique du profil à l'inscription Supabase Auth -----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, "avatarUrl")
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Fonctions utilitaires pour les policies (évite de répéter les EXISTS) --

create or replace function public.owns_horse(_horse_id uuid)
returns boolean
language sql
security invoker
stable
as $$
  select exists (
    select 1 from public.horses h
    where h.id = _horse_id and h."userId" = auth.uid()
  );
$$;

create or replace function public.owns_program(_program_id uuid)
returns boolean
language sql
security invoker
stable
as $$
  select exists (
    select 1 from public.programs p
    join public.horses h on h.id = p."horseId"
    where p.id = _program_id and h."userId" = auth.uid()
  );
$$;

create or replace function public.owns_session(_session_id uuid)
returns boolean
language sql
security invoker
stable
as $$
  select exists (
    select 1 from public.training_sessions s
    join public.horses h on h.id = s."horseId"
    where s.id = _session_id and h."userId" = auth.uid()
  );
$$;

-- 4. Activer RLS sur toutes les tables --------------------------------------

alter table public.users             enable row level security;
alter table public.auth_sessions     enable row level security;
alter table public.payments          enable row level security;
alter table public.horses            enable row level security;
alter table public.programs          enable row level security;
alter table public.weeks             enable row level security;
alter table public.training_sessions enable row level security;
alter table public.exercises         enable row level security;
alter table public.debriefs          enable row level security;
alter table public.events            enable row level security;
alter table public.documents         enable row level security;
alter table public.media_entries     enable row level security;
alter table public.xp_logs           enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- 5. Policies -----------------------------------------------------------

-- users : chacun voit/modifie sa propre ligne (création gérée par le trigger)
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- auth_sessions : legacy, lecture de ses propres tokens uniquement
drop policy if exists "auth_sessions_select_own" on public.auth_sessions;
create policy "auth_sessions_select_own" on public.auth_sessions
  for select using ("userId" = auth.uid());

-- payments : lecture de ses propres paiements seulement (écriture = API
-- backend uniquement, via connexion directe DATABASE_URL qui bypass RLS)
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using ("userId" = auth.uid());

-- horses : CRUD complet sur ses propres chevaux
drop policy if exists "horses_all_own" on public.horses;
create policy "horses_all_own" on public.horses
  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());

-- programs : via le cheval parent
drop policy if exists "programs_all_own" on public.programs;
create policy "programs_all_own" on public.programs
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- weeks : via le programme parent
drop policy if exists "weeks_all_own" on public.weeks;
create policy "weeks_all_own" on public.weeks
  for all using (public.owns_program("programId")) with check (public.owns_program("programId"));

-- training_sessions : via le cheval parent
drop policy if exists "training_sessions_all_own" on public.training_sessions;
create policy "training_sessions_all_own" on public.training_sessions
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- exercises : via la séance parente
drop policy if exists "exercises_all_own" on public.exercises;
create policy "exercises_all_own" on public.exercises
  for all using (public.owns_session("sessionId")) with check (public.owns_session("sessionId"));

-- debriefs : via la séance parente
drop policy if exists "debriefs_all_own" on public.debriefs;
create policy "debriefs_all_own" on public.debriefs
  for all using (public.owns_session("sessionId")) with check (public.owns_session("sessionId"));

-- events : via le cheval parent
drop policy if exists "events_all_own" on public.events;
create policy "events_all_own" on public.events
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- documents : via le cheval parent
drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- media_entries : via la séance parente
drop policy if exists "media_entries_all_own" on public.media_entries;
create policy "media_entries_all_own" on public.media_entries
  for all using (public.owns_session("sessionId")) with check (public.owns_session("sessionId"));

-- xp_logs : propriétaire direct, lecture/écriture de ses propres logs
drop policy if exists "xp_logs_all_own" on public.xp_logs;
create policy "xp_logs_all_own" on public.xp_logs
  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());

-- achievements : catalogue public en lecture pour tout utilisateur connecté
-- (écriture réservée à l'admin / service role, qui bypass RLS)
drop policy if exists "achievements_select_all" on public.achievements;
create policy "achievements_select_all" on public.achievements
  for select using (auth.role() = 'authenticated');

-- user_achievements : chacun voit/débloque ses propres badges
drop policy if exists "user_achievements_all_own" on public.user_achievements;
create policy "user_achievements_all_own" on public.user_achievements
  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
