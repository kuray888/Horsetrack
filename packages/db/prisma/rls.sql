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
--
-- IMPORTANT (cf. audit sécurité) : dans toutes les fonctions ci-dessous, un
-- `trialEndsAt` absent (NULL) doit toujours REFUSER l'accès/le quota payant,
-- jamais l'accorder par défaut — un essai TRIALING sans date de fin n'est pas
-- un essai confirmé par RevenueCat. C'est la même logique de fail-closed que
-- `isActiveOrTrialing` côté mobile et `isGrandPrixRider` côté API.
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

-- Entitlement (grille tarifaire, cf. schema.prisma SubscriptionTier) ---------
-- Jusqu'ici, ces limites n'étaient vérifiées QUE côté app mobile (cf.
-- maxHorses/HORSE_LIMITS dans subscription/store.tsx, ShareLocked dans
-- share-horse-modal.tsx) : les policies "_all_own" ci-dessous ne vérifiaient
-- que la propriété, jamais le palier ni le nombre déjà possédé. N'importe qui
-- contournant l'app (appel direct à l'API Supabase avec son propre token)
-- pouvait donc ajouter des chevaux ou des partages au-delà de son palier
-- gratuitement. Les fonctions ci-dessous répliquent, côté base, exactement la
-- même logique d'éligibilité que `isActiveOrTrialing` (cf.
-- mobile/src/subscription/store.tsx) : TRIALING ne compte que si
-- `trialEndsAt` n'est pas dépassé.

-- security definer : doit lire rider_profiles même si l'appelant n'a accès
-- qu'à SES propres lignes via RLS — mêmes garanties que owns_rider_profile/
-- owns_horse ci-dessus (search_path figé, lecture interne qui ne re-déclenche
-- pas la RLS de rider_profiles).
-- Pivot freemium du 2026-09-03 (v2), puis pivot chevaux illimités du
-- 2026-09-05 (v3) : palier gratuit permanent (1 cheval, planning/agenda/
-- journal/dépenses de base) + palier Premium payant à chevaux ILLIMITÉS
-- (partage, coffre-fort, concours multi-épreuves, rappels automatiques),
-- essai Premium d'1 mois. Le concept d'add-on "cheval supplémentaire"
-- (colonne `extraHorseSlots`) est retiré : Premium n'a plus besoin d'en
-- acheter, la colonne reste en base (non supprimée, pas de migration
-- destructive) mais n'est plus lue ici. Le gating continue de reposer sur le
-- STATUT (`subscriptionStatus`/`trialEndsAt`), pas sur `subscriptionTier`
-- (resté FREE en base pour tout le monde, cf.
-- protect_rider_profile_entitlements — pas de migration de données requise).
create or replace function public.effective_horse_limit(_rider_profile_id text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select
        case
          when rp."subscriptionStatus" = 'ACTIVE'
            or (rp."subscriptionStatus" = 'TRIALING' and (rp."trialEndsAt" is not null and rp."trialEndsAt" > now()))
          -- Premium = illimité (cf. pivot produit du 2026-09-05) — valeur
          -- sentinelle max int32, la colonne reste `integer` (pas de
          -- changement de type). Synchronisé avec PREMIUM_HORSE_LIMIT côté
          -- mobile (subscription/logic.ts).
          then 2147483647
          -- Palier gratuit standard (jamais abonné, essai/abo expiré ou
          -- annulé) : 1 cheval, pas une simple "grâce" temporaire — c'est la
          -- vraie limite du palier Free, cf. subscription/logic.ts
          -- FREE_HORSE_LIMIT côté mobile (doit rester synchronisé avec cette
          -- valeur).
          else 1
        end
      from public.rider_profiles rp
      where rp.id = _rider_profile_id
    ),
    1
  );
$$;

-- Vérité unique de l'accès Premium (actif ou en essai valide) — utilisée pour
-- gater les fonctionnalités payantes uniquement (coffre-fort, partage,
-- concours multi-épreuves, mise à jour du profil cheval/cavalier au-delà de
-- la création). Les fonctionnalités du palier gratuit (agenda, journal,
-- planning, dépenses de base, objectifs) n'appellent PAS cette fonction —
-- voir les policies correspondantes plus bas, qui ne vérifient que la
-- propriété/le partage.
drop function if exists public.horse_owner_is_paddock_or_above(text);

create or replace function public.rider_is_active_or_trialing(_rider_profile_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select rp."subscriptionStatus" = 'ACTIVE'
        or (rp."subscriptionStatus" = 'TRIALING' and (rp."trialEndsAt" is not null and rp."trialEndsAt" > now()))
      from public.rider_profiles rp
      where rp.id = _rider_profile_id
    ),
    false
  );
$$;

-- Même vérité, prenant un horseId (disponible directement dans les policies
-- horseId-scoped ci-dessous — appointments, journal_entries, etc.).
create or replace function public.horse_owner_is_active_or_trialing(_horse_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select public.rider_is_active_or_trialing(h."ownerId")
      from public.horses h
      where h.id = _horse_id
    ),
    false
  );
$$;

-- Protection des champs d'entitlement de rider_profiles (cf. audit sécurité)
-- ---------------------------------------------------------------------------
-- `rider_profiles_all_own` (policy "for all" ci-dessous) ne restreint que la
-- PROPRIÉTÉ de la ligne, pas les colonnes modifiables : sans ce trigger, un
-- utilisateur authentifié peut s'auto-attribuer subscriptionTier=GRAND_PRIX/
-- subscriptionStatus=ACTIVE/extraHorseSlots=999 via un simple update Supabase
-- direct, en contournant totalement RevenueCat. Ces colonnes ne doivent être
-- écrites QUE par le backend (webhook RevenueCat, connexion DATABASE_URL qui
-- ne passe jamais par auth.uid()) — même distinction que coach_usage/
-- email_reminders, mais ici via trigger plutôt que "pas de policy d'écriture"
-- car les colonnes protégées cohabitent dans la même ligne que des colonnes
-- librement éditables par le client (level, mainDiscipline...).
create or replace function public.protect_rider_profile_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() n'est non-null que pour une requête passée par l'API Supabase
  -- (rôle authenticated, gouverné par RLS) — jamais pour la connexion directe
  -- DATABASE_URL/Prisma du backend, seule habilitée à modifier ces champs.
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      new."subscriptionTier" := old."subscriptionTier";
      new."subscriptionStatus" := old."subscriptionStatus";
      new."trialEndsAt" := old."trialEndsAt";
      new."extraHorseSlots" := old."extraHorseSlots";
      new."revenuecatId" := old."revenuecatId";
      new."lastWebhookEventAt" := old."lastWebhookEventAt";
    elsif tg_op = 'INSERT' then
      new."subscriptionTier" := 'FREE';
      new."subscriptionStatus" := 'EXPIRED';
      new."trialEndsAt" := null;
      new."extraHorseSlots" := 0;
      new."revenuecatId" := null;
      new."lastWebhookEventAt" := null;
    end if;
  end if;
  return new;
end;
$$;

-- Verrouillage des quotas chevaux/partage contre les inserts concurrents
-- (cf. audit sécurité) --------------------------------------------------
-- Les policies horses_insert_own / horse_collaborators_owner_insert vérifient
-- déjà le quota via un `count(*) < limite` dans leur WITH CHECK, mais deux
-- inserts simultanés (2 requêtes quasi simultanées sur le même compte)
-- peuvent chacun lire le compte AVANT que l'autre ne commite et dépasser la
-- limite (TOCTOU classique des contraintes basées sur une sous-requête). Le
-- verrou advisory (portée transaction, keyé sur le propriétaire/cheval)
-- sérialise ces inserts sans verrouiller toute la table ; la policy RLS reste
-- en place en défense en profondeur.
create or replace function public.enforce_horse_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('horses_quota:' || new."ownerId", 0));
  if (select count(*) from public.horses h2 where h2."ownerId" = new."ownerId") >= public.effective_horse_limit(new."ownerId") then
    raise exception 'horse quota exceeded for rider profile %', new."ownerId";
  end if;
  return new;
end;
$$;

create or replace function public.enforce_horse_collaborator_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('horse_collaborators_quota:' || new."horseId", 0));
  if (select count(*) from public.horse_collaborators hc2 where hc2."horseId" = new."horseId") >= 1 then
    raise exception 'horse % already has a collaborator', new."horseId";
  end if;
  return new;
end;
$$;

-- 3. Activer RLS sur toutes les tables --------------------------------------

alter table public.users          enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.horses         enable row level security;
alter table public.horse_traits   enable row level security;
alter table public.horse_injuries enable row level security;
alter table public.goals          enable row level security;
alter table public.sessions       enable row level security;
alter table public.email_reminders enable row level security;
alter table public.documents      enable row level security;
alter table public.appointments   enable row level security;
alter table public.journal_entries enable row level security;
alter table public.horse_collaborators enable row level security;
alter table public.training_sessions  enable row level security;
alter table public.competition_entries enable row level security;
alter table public.expenses           enable row level security;
alter table public.revenuecat_webhook_events enable row level security;
alter table public.horse_weight_measurements enable row level security;
-- promo_codes / promo_code_redemptions : aucune policy plus bas, volontairement
-- (même traitement que revenuecat_webhook_events ci-dessus) — la validation et
-- l'application d'un code promo passent exclusivement par /api/promo/redeem
-- (connexion Prisma directe DATABASE_URL, hors RLS) ; RLS activée sans aucune
-- policy bloque tout accès direct via le client mobile (anon/authenticated),
-- fail-closed par construction plutôt que par une policy qu'on pourrait
-- oublier de restreindre correctement.
alter table public.promo_codes            enable row level security;
alter table public.promo_code_redemptions enable row level security;

-- 4. Policies -----------------------------------------------------------

-- users : chacun voit/modifie sa propre ligne (création gérée par le trigger,
-- pas d'insert policy : un insert direct via supabase-js reste bloqué)
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (id = auth.uid()::text);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (id = auth.uid()::text) with check (id = auth.uid()::text);

-- rider_profiles : 1-1 avec users. Le profil cavalier lui-même (niveau,
-- discipline, objectif...) fait partie du palier gratuit — seules les
-- colonnes d'entitlement (subscriptionTier/Status, trialEndsAt...) sont
-- protégées, via le trigger protect_rider_profile_entitlements ci-dessus, pas
-- via cette policy.
drop policy if exists "rider_profiles_all_own" on public.rider_profiles;

drop policy if exists "rider_profiles_select_own" on public.rider_profiles;
create policy "rider_profiles_select_own" on public.rider_profiles
  for select using ("userId" = auth.uid()::text);

drop policy if exists "rider_profiles_insert_own" on public.rider_profiles;
create policy "rider_profiles_insert_own" on public.rider_profiles
  for insert with check ("userId" = auth.uid()::text);

drop policy if exists "rider_profiles_update_own" on public.rider_profiles;
create policy "rider_profiles_update_own" on public.rider_profiles
  for update using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- Voir protect_rider_profile_entitlements ci-dessus : la policy "for all"
-- au-dessus ne protège que la ligne, pas les colonnes d'entitlement.
drop trigger if exists protect_rider_profile_entitlements on public.rider_profiles;
create trigger protect_rider_profile_entitlements
  before insert or update on public.rider_profiles
  for each row execute function public.protect_rider_profile_entitlements();

-- horses : CRUD via le rider_profile parent — 4 policies granulaires plutôt
-- qu'une seule "for all" : seul l'INSERT doit vérifier le quota de chevaux du
-- palier (cf. effective_horse_limit ci-dessus), select/update/delete restent
-- ouverts à tout propriétaire comme avant.
drop policy if exists "horses_all_own" on public.horses;

drop policy if exists "horses_select_own" on public.horses;
create policy "horses_select_own" on public.horses
  for select using (public.owns_rider_profile("ownerId"));

-- update/delete d'un cheval déjà créé : la fiche du cheval (unique en
-- gratuit) fait partie du palier gratuit — seul le NOMBRE de chevaux est
-- payant (cf. horses_insert_own/effective_horse_limit ci-dessus).
drop policy if exists "horses_update_own" on public.horses;
create policy "horses_update_own" on public.horses
  for update using (public.owns_rider_profile("ownerId"))
  with check (public.owns_rider_profile("ownerId"));

drop policy if exists "horses_delete_own" on public.horses;
create policy "horses_delete_own" on public.horses
  for delete using (public.owns_rider_profile("ownerId"));

-- Compte les chevaux déjà possédés (hors celui en cours d'insertion, pas
-- encore commité) et compare au quota du palier — bloque l'ajout au-delà de
-- la limite, quel que soit le client qui tente l'insert (app ou appel direct).
drop policy if exists "horses_insert_own" on public.horses;
create policy "horses_insert_own" on public.horses
  for insert with check (
    public.owns_rider_profile("ownerId")
    and (select count(*) from public.horses h2 where h2."ownerId" = "ownerId") < public.effective_horse_limit("ownerId")
  );

-- Voir enforce_horse_quota ci-dessus : ferme la course entre inserts
-- concurrents que le WITH CHECK seul ne peut pas empêcher.
drop trigger if exists enforce_horse_quota on public.horses;
create trigger enforce_horse_quota
  before insert on public.horses
  for each row execute function public.enforce_horse_quota();

-- horse_traits / horse_injuries : via le cheval parent — non gatées par
-- abonnement, comme le reste de la fiche cheval (horses_update_own
-- ci-dessus) : ces tags/blessures font partie du palier gratuit. Accessoirement,
-- ça évite aussi tout risque de perdre silencieusement les traits/blessures
-- saisis en onboarding (pushHorseTraitsAndInjuries() est appelé dans le même
-- lot que la création du premier cheval, cf. paywall.tsx finish() →
-- pushHorses()) le temps que le webhook RevenueCat arrive.
drop policy if exists "horse_traits_all_own" on public.horse_traits;
create policy "horse_traits_all_own" on public.horse_traits
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

drop policy if exists "horse_injuries_all_own" on public.horse_injuries;
create policy "horse_injuries_all_own" on public.horse_injuries
  for all using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

-- goals : rattaché au rider_profile (et parfois à un cheval, mais le
-- propriétaire de référence reste toujours le rider_profile) — fait partie du
-- palier gratuit (se fixer des objectifs n'est pas un argument payant).
drop policy if exists "goals_all_own" on public.goals;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (public.owns_rider_profile("riderId"));

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (public.owns_rider_profile("riderId"));

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (public.owns_rider_profile("riderId"))
  with check (public.owns_rider_profile("riderId"));

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (public.owns_rider_profile("riderId"));

-- email_reminders : lecture seule pour le propriétaire, écriture réservée au
-- backend (création/cron via DATABASE_URL, bypass RLS)
drop policy if exists "email_reminders_select_own" on public.email_reminders;
create policy "email_reminders_select_own" on public.email_reminders
  for select using ("userId" = auth.uid()::text);

-- documents : rattaché au rider_profile, CRUD complet écrit directement par
-- le client mobile (cf. lib/cloudSync.ts) — le coffre-fort numérique est une
-- fonctionnalité Premium (cf. audit produit/plan freemium du 2026-09-03),
-- donc gaté par abonnement actif/en essai, contrairement à goals ci-dessus.
drop policy if exists "documents_all_own" on public.documents;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
  for select using (public.owns_rider_profile("riderId"));

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents
  for insert with check (public.owns_rider_profile("riderId") and public.rider_is_active_or_trialing("riderId"));

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents
  for update using (public.owns_rider_profile("riderId") and public.rider_is_active_or_trialing("riderId"))
  with check (public.owns_rider_profile("riderId") and public.rider_is_active_or_trialing("riderId"));

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents
  for delete using (public.owns_rider_profile("riderId") and public.rider_is_active_or_trialing("riderId"));

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
-- un accès complet — "le calendrier" du brief. Le suivi de base (rendez-vous,
-- journal) fait partie du palier gratuit, y compris les rendez-vous de type
-- concours (checklist/dossard/notes) : seules les épreuves détaillées
-- (competition_entries, cf. plus bas) et les rappels programmés (gérés côté
-- app/API, pas par une colonne ici) restent Premium. Écriture non gatée par
-- abonnement, donc — can_access_horse seul suffit, propriétaire ou
-- collaborateur (le partage lui-même reste Premium, cf.
-- horse_collaborators_owner_insert plus bas : un compte gratuit n'a donc de
-- toute façon jamais de collaborateur).
drop policy if exists "appointments_shared" on public.appointments;

drop policy if exists "appointments_select_shared" on public.appointments;
create policy "appointments_select_shared" on public.appointments
  for select using (public.can_access_horse("horseId"));

drop policy if exists "appointments_insert_shared" on public.appointments;
create policy "appointments_insert_shared" on public.appointments
  for insert with check (public.can_access_horse("horseId"));

drop policy if exists "appointments_update_shared" on public.appointments;
create policy "appointments_update_shared" on public.appointments
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));

drop policy if exists "appointments_delete_shared" on public.appointments;
create policy "appointments_delete_shared" on public.appointments
  for delete using (public.can_access_horse("horseId"));

drop policy if exists "journal_entries_shared" on public.journal_entries;

drop policy if exists "journal_entries_select_shared" on public.journal_entries;
create policy "journal_entries_select_shared" on public.journal_entries
  for select using (public.can_access_horse("horseId"));

drop policy if exists "journal_entries_insert_shared" on public.journal_entries;
create policy "journal_entries_insert_shared" on public.journal_entries
  for insert with check (public.can_access_horse("horseId"));

drop policy if exists "journal_entries_update_shared" on public.journal_entries;
create policy "journal_entries_update_shared" on public.journal_entries
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));

drop policy if exists "journal_entries_delete_shared" on public.journal_entries;
create policy "journal_entries_delete_shared" on public.journal_entries
  for delete using (public.can_access_horse("horseId"));

-- competition_entries : épreuves d'un concours — pas de horseId direct (child
-- d'Appointment, cf. schema.prisma), donc on remonte au cheval du rendez-vous
-- parent à chaque fois. Contrairement à appointments (gratuit), l'écriture
-- ici reste Premium : "concours multi-épreuves" est le vrai argument payant
-- (un rendez-vous concours seul, avec checklist/dossard, reste gratuit —
-- seul le détail par épreuve est verrouillé). Lecture inconditionnelle comme
-- partout ailleurs.
drop policy if exists "competition_entries_shared" on public.competition_entries;

drop policy if exists "competition_entries_select_shared" on public.competition_entries;
create policy "competition_entries_select_shared" on public.competition_entries
  for select using (
    exists (select 1 from public.appointments a where a.id = "appointmentId" and public.can_access_horse(a."horseId"))
  );

drop policy if exists "competition_entries_insert_shared" on public.competition_entries;
create policy "competition_entries_insert_shared" on public.competition_entries
  for insert with check (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.can_access_horse(a."horseId")
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  );

drop policy if exists "competition_entries_update_shared" on public.competition_entries;
create policy "competition_entries_update_shared" on public.competition_entries
  for update using (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.can_access_horse(a."horseId")
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  )
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.can_access_horse(a."horseId")
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  );

drop policy if exists "competition_entries_delete_shared" on public.competition_entries;
create policy "competition_entries_delete_shared" on public.competition_entries
  for delete using (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.can_access_horse(a."horseId")
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  );

-- horse_collaborators : le propriétaire du cheval gère ses invitations
-- (créer/lister/révoquer) ; l'invité voit et accepte sa propre ligne avant
-- acceptation par correspondance d'email (seule donnée disponible tant que
-- collaboratorUserId est encore vide), puis par collaboratorUserId une fois
-- acceptée (cf. can_access_horse, qui filtre par collaboratorUserId — sans
-- cette 2e policy, can_access_horse ne verrait jamais sa propre ligne après
-- acceptation si jamais le claim email venait à manquer/changer).
-- 4 policies granulaires plutôt qu'une seule "for all" : seul l'INSERT doit
-- vérifier l'abonnement actif/en essai (cf. horse_owner_is_active_or_trialing)
-- et la limite d'1 collaborateur par cheval — select/update/delete restent
-- ouverts au propriétaire comme avant (annuler un partage doit rester
-- possible même après expiration, par exemple).
drop policy if exists "horse_collaborators_owner_all" on public.horse_collaborators;

drop policy if exists "horse_collaborators_owner_select" on public.horse_collaborators;
create policy "horse_collaborators_owner_select" on public.horse_collaborators
  for select using (public.owns_horse("horseId"));

drop policy if exists "horse_collaborators_owner_update" on public.horse_collaborators;
create policy "horse_collaborators_owner_update" on public.horse_collaborators
  for update using (public.owns_horse("horseId")) with check (public.owns_horse("horseId"));

drop policy if exists "horse_collaborators_owner_delete" on public.horse_collaborators;
create policy "horse_collaborators_owner_delete" on public.horse_collaborators
  for delete using (public.owns_horse("horseId"));

drop policy if exists "horse_collaborators_owner_insert" on public.horse_collaborators;
create policy "horse_collaborators_owner_insert" on public.horse_collaborators
  for insert with check (
    public.owns_horse("horseId")
    and public.horse_owner_is_active_or_trialing("horseId")
    and (select count(*) from public.horse_collaborators hc2 where hc2."horseId" = "horseId") < 1
  );

-- Voir enforce_horse_collaborator_quota ci-dessus : même fermeture de race
-- condition que enforce_horse_quota, pour la limite d'1 collaborateur/cheval.
drop trigger if exists enforce_horse_collaborator_quota on public.horse_collaborators;
create trigger enforce_horse_collaborator_quota
  before insert on public.horse_collaborators
  for each row execute function public.enforce_horse_collaborator_quota();

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

-- training_sessions : séances planifiées manuellement par le cavalier — le
-- planning est la fonctionnalité coeur du palier gratuit, non gatée. Même
-- portée de partage que appointments/journal_entries (can_access_horse), même
-- si un compte gratuit n'a jamais de collaborateur en pratique (le partage
-- lui-même est Premium).
drop policy if exists "training_sessions_shared" on public.training_sessions;

drop policy if exists "training_sessions_select_shared" on public.training_sessions;
create policy "training_sessions_select_shared" on public.training_sessions
  for select using (public.can_access_horse("horseId"));

drop policy if exists "training_sessions_insert_shared" on public.training_sessions;
create policy "training_sessions_insert_shared" on public.training_sessions
  for insert with check (public.can_access_horse("horseId"));

drop policy if exists "training_sessions_update_shared" on public.training_sessions;
create policy "training_sessions_update_shared" on public.training_sessions
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));

drop policy if exists "training_sessions_delete_shared" on public.training_sessions;
create policy "training_sessions_delete_shared" on public.training_sessions
  for delete using (public.can_access_horse("horseId"));

-- expenses : le suivi de dépenses de base fait partie du palier gratuit (le
-- statut payé/à régler détaillé restera, lui, une distinction Premium côté
-- app — cf. plan freemium). Même portée de partage que training_sessions ci-dessus.
drop policy if exists "expenses_shared" on public.expenses;

drop policy if exists "expenses_select_shared" on public.expenses;
create policy "expenses_select_shared" on public.expenses
  for select using (public.can_access_horse("horseId"));

drop policy if exists "expenses_insert_shared" on public.expenses;
create policy "expenses_insert_shared" on public.expenses
  for insert with check (public.can_access_horse("horseId"));

drop policy if exists "expenses_update_shared" on public.expenses;
create policy "expenses_update_shared" on public.expenses
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));

drop policy if exists "expenses_delete_shared" on public.expenses;
create policy "expenses_delete_shared" on public.expenses
  for delete using (public.can_access_horse("horseId"));

-- horse_weight_measurements : suivi de poids (audit produit post-V1, phase 5)
-- — suivi de base comme Santé/Entraînement, non gaté Premium. Même portée de
-- partage que training_sessions ci-dessus (can_access_horse) : un
-- collaborateur qui s'occupe du cheval doit pouvoir peser et noter, pas
-- seulement le propriétaire.
drop policy if exists "horse_weight_measurements_select_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_select_shared" on public.horse_weight_measurements
  for select using (public.can_access_horse("horseId"));

drop policy if exists "horse_weight_measurements_insert_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_insert_shared" on public.horse_weight_measurements
  for insert with check (public.can_access_horse("horseId"));

drop policy if exists "horse_weight_measurements_update_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_update_shared" on public.horse_weight_measurements
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));

drop policy if exists "horse_weight_measurements_delete_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_delete_shared" on public.horse_weight_measurements
  for delete using (public.can_access_horse("horseId"));

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

-- 6. Storage : bucket "horse-photos" (photo de profil du cheval) ------------
-- Bucket privé comme "documents", mais scoping différent : une photo de
-- cheval doit rester visible par le propriétaire ET par les collaborateurs
-- acceptés (même règle que la lecture de la fiche cheval, cf.
-- horses_select_shared plus haut) — donc scoping par horseId (premier segment
-- du chemin "{horseId}/photo.jpg"), pas par auth.uid() comme documents.
-- Écriture (insert/update/delete) réservée au propriétaire (owns_horse), la
-- lecture est ouverte à can_access_horse via une policy SELECT séparée
-- (policies permissives combinées en OR, même pattern que horses_select_shared).
insert into storage.buckets (id, name, public)
values ('horse-photos', 'horse-photos', false)
on conflict (id) do nothing;

drop policy if exists "horse_photos_select_shared" on storage.objects;
create policy "horse_photos_select_shared" on storage.objects
  for select using (bucket_id = 'horse-photos' and public.can_access_horse((storage.foldername(name))[1]));

drop policy if exists "horse_photos_write_own" on storage.objects;
create policy "horse_photos_write_own" on storage.objects
  for all using (bucket_id = 'horse-photos' and public.owns_horse((storage.foldername(name))[1]))
  with check (bucket_id = 'horse-photos' and public.owns_horse((storage.foldername(name))[1]));

-- sessions : table de jetons d'auth « legacy », non utilisée par le code
-- actuel (le mobile passe par Supabase Auth, pas par ce modèle Prisma —
-- aucune référence à `db.session` trouvée dans apps/api ou apps/mobile).
-- RLS activée sans aucune policy = personne ne peut y toucher via
-- supabase-js (le rôle service/Prisma bypass RLS de toute façon).
-- Candidate à la suppression du schéma si elle reste inutilisée.

-- revenuecat_webhook_events : dédup du webhook RevenueCat (cf. route.ts) —
-- écrite exclusivement par le backend (DATABASE_URL, bypass RLS), jamais
-- lue ni écrite par un client. RLS activée sans aucune policy = même
-- pattern que `sessions` ci-dessus : personne ne peut y toucher via
-- supabase-js.
