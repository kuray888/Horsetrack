-- ============================================================================
-- À exécuter APRÈS `pnpm db:push` (les tables doivent déjà exister).
-- Idempotent : peut être relancé sans risque.
-- Colonnes en camelCase entre guillemets : ce sont les noms de colonnes réels
-- générés par Prisma (pas de @map sur les champs scalaires dans schema.prisma).
--
-- Réécrit le 2026-06-19 pour matcher le schéma actuel (users / rider_profiles
-- / horses / horse_traits / goals / sessions / payments). L'ancienne version
-- visait un schéma différent (programs / weeks / training_sessions / ...) qui
-- n'existe plus dans schema.prisma.
--
-- Détail important : `User.id` est `String @id @default(cuid())` côté Prisma,
-- donc la colonne Postgres est `text`, pas `uuid`. `auth.uid()` renvoie un
-- `uuid`. On ne peut donc pas créer de contrainte FOREIGN KEY directe entre
-- `public.users.id` et `auth.users.id` (types incompatibles, Postgres refuse).
-- On compare donc partout avec un cast explicite `auth.uid()::text`, et le
-- lien entre les deux se fait uniquement via le trigger ci-dessous (qui
-- recopie l'UUID Supabase Auth en texte dans `public.users.id`), sans FK.
-- ============================================================================

-- 1. Création automatique du profil à l'inscription Supabase Auth -----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- "updatedAt" n'a pas de DEFAULT Postgres (@updatedAt est une convention
  -- Prisma Client, pas un trigger DB) : il faut le fournir explicitement, sinon
  -- l'insert échoue (NOT NULL) et aucune ligne public.users n'est jamais créée.
  insert into public.users (id, email, name, "avatarUrl", "updatedAt")
  values (
    new.id::text,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Fonctions utilitaires pour les policies (évite de répéter les EXISTS) --
-- horses."ownerId" pointe vers rider_profiles.id (pas directement vers
-- users.id) : il faut remonter par rider_profiles pour vérifier le
-- propriétaire réel (auth.uid()).

-- security definer (pas invoker) : depuis l'ajout du partage, `horses` a une
-- policy SELECT qui appelle can_access_horse(), qui appelle owns_horse(), qui
-- lit `horses` — en security invoker, cette lecture interne re-déclenche la
-- RLS de `horses` (donc can_access_horse() à nouveau) → récursion infinie
-- ("stack depth limit exceeded"). En security definer, owns_rider_profile/
-- owns_horse contournent RLS pour leur propre lecture interne, cassant la
-- boucle — exactement le même besoin que handle_new_user() ci-dessus, donc
-- même mitigation (search_path figé pour ne pas être détourné).
create or replace function public.owns_rider_profile(_rider_profile_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rider_profiles rp
    where rp.id = _rider_profile_id and rp."userId" = auth.uid()::text
  );
$$;

create or replace function public.owns_horse(_horse_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.horses h
    join public.rider_profiles rp on rp.id = h."ownerId"
    where h.id = _horse_id and rp."userId" = auth.uid()::text
  );
$$;

-- Partage (demi-pension / coach, cf. lib/sharing.ts) : propriétaire OU
-- collaborateur dont l'invitation a été acceptée. Utilisée pour le calendrier
-- (lecture/écriture) et pour la lecture du profil cheval/traits/blessures —
-- jamais pour l'écriture du profil, qui reste exclusivement owns_horse.
create or replace function public.can_access_horse(_horse_id text)
returns boolean
language sql
security invoker
stable
as $$
  select public.owns_horse(_horse_id)
    or exists (
      select 1 from public.horse_collaborators hc
      where hc."horseId" = _horse_id
        and hc."collaboratorUserId" = auth.uid()::text
        and hc.status = 'ACCEPTED'
    );
$$;

-- 3. Activer RLS sur toutes les tables --------------------------------------

alter table public.users          enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.horses         enable row level security;
alter table public.horse_traits   enable row level security;
alter table public.horse_injuries enable row level security;
alter table public.goals          enable row level security;
alter table public.sessions       enable row level security;
alter table public.coach_usage    enable row level security;
alter table public.email_reminders enable row level security;
alter table public.documents      enable row level security;
alter table public.appointments   enable row level security;
alter table public.journal_entries enable row level security;
alter table public.horse_collaborators enable row level security;
alter table public.horse_progress     enable row level security;
alter table public.horse_programs     enable row level security;

-- 4. Policies -----------------------------------------------------------

-- users : chacun voit/modifie sa propre ligne (création gérée par le trigger,
-- pas d'insert policy : un insert direct via supabase-js reste bloqué)
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (id = auth.uid()::text);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (id = auth.uid()::text) with check (id = auth.uid()::text);

-- rider_profiles : 1-1 avec users, CRUD complet sur son propre profil
-- (c'est ici que l'onboarding écrira une fois branché sur Supabase)
drop policy if exists "rider_profiles_all_own" on public.rider_profiles;
create policy "rider_profiles_all_own" on public.rider_profiles
  for all using ("userId" = auth.uid()::text) with check ("userId" = auth.uid()::text);

-- horses : CRUD via le rider_profile parent
drop policy if exists "horses_all_own" on public.horses;
create policy "horses_all_own" on public.horses
  for all using (public.owns_rider_profile("ownerId")) with check (public.owns_rider_profile("ownerId"));

-- horse_traits : via le cheval parent
drop policy if exists "horse_traits_all_own" on public.horse_traits;
create policy "horse_traits_all_own" on public.horse_traits
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- horse_injuries : via le cheval parent (même logique que horse_traits)
drop policy if exists "horse_injuries_all_own" on public.horse_injuries;
create policy "horse_injuries_all_own" on public.horse_injuries
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- goals : rattaché au rider_profile (et parfois à un cheval, mais le
-- propriétaire de référence reste toujours le rider_profile)
drop policy if exists "goals_all_own" on public.goals;
create policy "goals_all_own" on public.goals
  for all using (public.owns_rider_profile("riderId")) with check (public.owns_rider_profile("riderId"));

-- coach_usage : lecture de son propre compteur seulement (écriture = API
-- backend uniquement, via connexion directe DATABASE_URL qui bypass RLS)
drop policy if exists "coach_usage_select_own" on public.coach_usage;
create policy "coach_usage_select_own" on public.coach_usage
  for select using ("userId" = auth.uid()::text);

-- email_reminders : même logique que coach_usage — lecture seule pour le
-- propriétaire, écriture réservée au backend (création/cron via DATABASE_URL)
drop policy if exists "email_reminders_select_own" on public.email_reminders;
create policy "email_reminders_select_own" on public.email_reminders
  for select using ("userId" = auth.uid()::text);

-- documents : rattaché au rider_profile, CRUD complet écrit directement par
-- le client mobile (cf. lib/cloudSync.ts) — même pattern que goals_all_own.
drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (public.owns_rider_profile("riderId")) with check (public.owns_rider_profile("riderId"));

-- Partage (cf. lib/sharing.ts) -----------------------------------------------

-- horses/horse_traits/horse_injuries : policy SUPPLÉMENTAIRE, lecture seule,
-- pour les collaborateurs acceptés — les policies "_all_own" ci-dessus restent
-- inchangées et continuent de réserver l'écriture du profil au propriétaire.
-- Une policy permissive en SELECT s'ajoute en OR à la policy ALL existante.
drop policy if exists "horses_select_shared" on public.horses;
create policy "horses_select_shared" on public.horses
  for select using (public.can_access_horse(id));

drop policy if exists "horse_traits_select_shared" on public.horse_traits;
create policy "horse_traits_select_shared" on public.horse_traits
  for select using (public.can_access_horse("horseId"));

drop policy if exists "horse_injuries_select_shared" on public.horse_injuries;
create policy "horse_injuries_select_shared" on public.horse_injuries
  for select using (public.can_access_horse("horseId"));

-- appointments / journal_entries : propriétaire ET collaborateur accepté ont
-- un accès complet (lecture/écriture) — "le calendrier" du brief. Une seule
-- policy par table puisque can_access_horse couvre déjà le cas propriétaire.
drop policy if exists "appointments_shared" on public.appointments;
create policy "appointments_shared" on public.appointments
  for all using (public.can_access_horse("horseId")) with check (public.can_access_horse("horseId"));

drop policy if exists "journal_entries_shared" on public.journal_entries;
create policy "journal_entries_shared" on public.journal_entries
  for all using (public.can_access_horse("horseId")) with check (public.can_access_horse("horseId"));

-- horse_collaborators : le propriétaire du cheval gère ses invitations
-- (créer/lister/révoquer) ; l'invité voit et accepte sa propre ligne avant
-- acceptation par correspondance d'email (seule donnée disponible tant que
-- collaboratorUserId est encore vide), puis par collaboratorUserId une fois
-- acceptée (cf. can_access_horse, qui filtre par collaboratorUserId — sans
-- cette 2e policy, can_access_horse ne verrait jamais sa propre ligne après
-- acceptation si jamais le claim email venait à manquer/changer).
drop policy if exists "horse_collaborators_owner_all" on public.horse_collaborators;
create policy "horse_collaborators_owner_all" on public.horse_collaborators
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

drop policy if exists "horse_collaborators_invitee_select" on public.horse_collaborators;
create policy "horse_collaborators_invitee_select" on public.horse_collaborators
  for select using (lower("invitedEmail") = lower(auth.jwt() ->> 'email'));

drop policy if exists "horse_collaborators_accepted_select" on public.horse_collaborators;
create policy "horse_collaborators_accepted_select" on public.horse_collaborators
  for select using ("collaboratorUserId" = auth.uid()::text);

-- with check supplémentaire (collaboratorUserId = soi-même) : empêche un
-- invité d'accepter sa propre ligne en y inscrivant l'id de quelqu'un d'autre.
drop policy if exists "horse_collaborators_invitee_accept" on public.horse_collaborators;
create policy "horse_collaborators_invitee_accept" on public.horse_collaborators
  for update using (lower("invitedEmail") = lower(auth.jwt() ->> 'email'))
  with check (lower("invitedEmail") = lower(auth.jwt() ->> 'email') and "collaboratorUserId" = auth.uid()::text);

-- horse_progress / horse_programs : continuité d'entraînement propre au
-- cavalier propriétaire — pas partagée avec un demi-pensionnaire/coach (pas
-- dans le brief de partage, contrairement au calendrier), donc owns_horse
-- plutôt que can_access_horse.
drop policy if exists "horse_progress_all_own" on public.horse_progress;
create policy "horse_progress_all_own" on public.horse_progress
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

drop policy if exists "horse_programs_all_own" on public.horse_programs;
create policy "horse_programs_all_own" on public.horse_programs
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- 5. Storage : bucket "documents" (coffre-fort) -----------------------------
-- Bucket privé : un document (ordonnance, facture...) ne doit jamais être
-- accessible sans authentification, donc pas d'URL publique permanente — cf.
-- lib/cloudSync.ts qui génère une URL signée à la demande. Chemin de chaque
-- fichier : "{auth.uid()}/{docId}.jpg", donc le scoping par propriétaire se
-- fait directement sur le premier segment du chemin, sans repasser par
-- rider_profiles (storage.objects n'a pas de lien direct vers le domaine
-- métier, juste un bucket_id + un nom de fichier).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_storage_all_own" on storage.objects;
create policy "documents_storage_all_own" on storage.objects
  for all using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- sessions : table de jetons d'auth « legacy », non utilisée par le code
-- actuel (le mobile passe par Supabase Auth, pas par ce modèle Prisma —
-- aucune référence à `db.session` trouvée dans apps/api ou apps/mobile).
-- RLS activée sans aucune policy = personne ne peut y toucher via
-- supabase-js (le rôle service/Prisma bypass RLS de toute façon).
-- Candidate à la suppression du schéma si elle reste inutilisée.
