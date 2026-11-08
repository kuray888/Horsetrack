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
          -- changement de type). Côté mobile, subscription/logic.ts utilise
          -- directement `Infinity` (plus de constante PREMIUM_HORSE_LIMIT
          -- depuis ce pivot) — les deux valeurs restent "illimité" en
          -- pratique, rien à garder synchronisé numériquement.
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
  -- `h2.id <> new.id` : exclut la ligne en cours d'upsert d'elle-même. Sans
  -- ça, ce trigger BEFORE INSERT (qui se déclenche aussi pour un upsert
  -- résolu en UPDATE via ON CONFLICT, cf. cloudSync.ts pushHorses) comptait
  -- un cheval déjà existant contre son propre quota à CHAQUE resynchro —
  -- un compte gratuit ayant déjà son unique cheval en base ne pouvait plus
  -- jamais réenregistrer sa fiche (nom, photo, poids...), rejeté en boucle
  -- silencieuse (cf. audit du 2026-09-16). Une vraie création n'est pas
  -- affectée : aucune ligne ne porte encore cet id au moment du check.
  if (select count(*) from public.horses h2 where h2."ownerId" = new."ownerId" and h2.id <> new.id) >= public.effective_horse_limit(new."ownerId") then
    raise exception 'horse quota exceeded for rider profile %', new."ownerId";
  end if;
  return new;
end;
$$;

-- Personnes avec qui un cheval peut être partagé : 5 si son propriétaire est
-- en Écurie Pro (actif ou en essai), 1 sinon — aligné sur
-- apps/api/src/lib/plans.ts COLLABORATORS_PER_HORSE.
create or replace function public.horse_collaborator_limit(_horse_id text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (
      select 1
      from public.horses h
      join public.rider_profiles rp on rp.id = h."ownerId"
      where h.id = _horse_id
        and rp."subscriptionTier" = 'PRO'
        and public.rider_is_active_or_trialing(rp.id)
    ) then 5
    else 1
  end;
$$;

revoke execute on function public.horse_collaborator_limit(text) from public, anon;
grant execute on function public.horse_collaborator_limit(text) to authenticated, service_role;

create or replace function public.enforce_horse_collaborator_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('horse_collaborators_quota:' || new."horseId", 0));
  -- Une invitation PENDING expirée (jamais acceptée, jamais renvoyée) ne doit
  -- pas occuper indéfiniment une place de collaborateur — sinon le
  -- propriétaire n'a d'autre recours que de la révoquer à la main avant de
  -- pouvoir en inviter un autre. `expiresAt is null` couvre les lignes créées
  -- avant l'ajout de ce champ (traitées comme non expirantes, cf. schema.prisma).
  if (
    select count(*) from public.horse_collaborators hc2
    where hc2."horseId" = new."horseId"
      and (hc2.status = 'ACCEPTED' or hc2."expiresAt" is null or hc2."expiresAt" > now())
  ) >= public.horse_collaborator_limit(new."horseId") then
    raise exception 'horse % has reached its collaborator limit', new."horseId";
  end if;
  return new;
end;
$$;

-- Défense en profondeur : journal_entries.photoPath Premium uniquement
-- (cf. audit sécurité pré-release du 2026-09-07) ----------------------------
-- Jusqu'ici, la seule restriction sur "photo du jour" (Journal Premium,
-- cf. Locked dans agenda/components/JournalForm.tsx) était côté UI mobile —
-- ni la policy Storage "horse-photos" (cf. plus bas, corrigée pour vérifier
-- horse_owner_is_active_or_trialing sur le sous-dossier "journal/"), ni la
-- table journal_entries elle-même, ne vérifiaient le palier d'abonnement.
-- Sans ce trigger, un compte Free contournant l'app (appel direct à l'API
-- Supabase avec son propre token) pouvait tout de même écrire une ligne
-- journal_entries avec un "photoPath" non-null (même sans jamais avoir pu
-- uploader l'objet Storage correspondant, ex: en réutilisant un chemin
-- existant d'une période Premium antérieure) — la policy RLS "_shared"
-- ci-dessous ne vérifie que can_access_horse, jamais le palier. Ne bloque
-- que la mise en place OU le remplacement d'un photoPath (comparaison à
-- l'ancienne valeur) : une ligne déjà pourvue d'une photo (créée pendant un
-- essai/abonnement actif) reste éditable sur ses autres champs (notes,
-- ressenti...) même après un retour au palier gratuit, seule une nouvelle
-- photo est refusée.
create or replace function public.protect_journal_entry_photo_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  photo_changed boolean;
  video_changed boolean;
begin
  -- OLD n'est pas une ligne "toutes colonnes NULL" pendant un INSERT, elle
  -- n'est pas assignée du tout — lire old."photoPath" dans ce cas lève
  -- "record \"old\" is not assigned yet" et ferait échouer TOUT insert dans
  -- journal_entries, pas seulement ceux avec photo. D'où la branche explicite
  -- sur tg_op plutôt qu'un simple OR : PostgreSQL ne garantit pas l'évaluation
  -- court-circuit des opérateurs booléens (contrairement à un langage
  -- procédural), donc `tg_op = 'INSERT' or old.… is distinct from …` resterait
  -- risqué même si ça "marche" en pratique la plupart du temps.
  -- La vidéo d'un souvenir (bloc B, 2026-10-27) suit la même règle.
  if tg_op = 'INSERT' then
    photo_changed := new."photoPath" is not null;
    video_changed := new."videoPath" is not null;
  else
    photo_changed := new."photoPath" is not null
      and old."photoPath" is distinct from new."photoPath";
    video_changed := new."videoPath" is not null
      and old."videoPath" is distinct from new."videoPath";
  end if;

  if (photo_changed or video_changed) and not public.horse_owner_is_active_or_trialing(new."horseId") then
    raise exception 'journal entry photo requires an active or trialing subscription';
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
alter table public.training_session_rides enable row level security;
-- Bloc B (cf. bloc-b-2026-10-27.sql) : horse_details (partage du cheval),
-- rider_contacts (personnel), referral_* (API seulement, sans policy).
alter table public.horse_details enable row level security;
alter table public.rider_contacts enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_uses enable row level security;
-- ride_shares : sans aucune policy, réservée à l'API (cf. seances-en-direct-2026-10-27.sql).
alter table public.ride_shares enable row level security;
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
-- `h2.id <> "id"` : même correction que enforce_horse_quota ci-dessus — sans
-- elle, un upsert résolu en UPDATE (ON CONFLICT) comptait la ligne existante
-- contre son propre quota à chaque resynchro (cf. audit du 2026-09-16).
drop policy if exists "horses_insert_own" on public.horses;
create policy "horses_insert_own" on public.horses
  for insert with check (
    public.owns_rider_profile("ownerId")
    and (select count(*) from public.horses h2 where h2."ownerId" = "ownerId" and h2.id <> "id") < public.effective_horse_limit("ownerId")
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

-- appointments / journal_entries (suivi de base, palier gratuit) : policies dans
-- la section « droits-par-role » en fin de fichier.

-- Voir protect_journal_entry_photo_premium plus haut.
drop trigger if exists journal_entries_protect_photo_premium on public.journal_entries;
create trigger journal_entries_protect_photo_premium
  before insert or update on public.journal_entries
  for each row execute function public.protect_journal_entry_photo_premium();

-- competition_entries (épreuves, Premium) : section « droits-par-role ».

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
-- possible même après expiration, par exemple). Écurie Pro v2 : le gérant
-- partage ces droits, sauf sur les gérants — policies owner_* dans la section
-- « droits-par-role » en fin de fichier.
drop policy if exists "horse_collaborators_owner_all" on public.horse_collaborators;

-- Voir enforce_horse_collaborator_quota ci-dessus : même fermeture de race
-- condition que enforce_horse_quota, pour la limite de collaborateurs par cheval.
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
-- `using` exige en plus une invitation encore valide (expiresAt null ou futur)
-- : une invitation PENDING expirée ne doit plus pouvoir être acceptée, même si
-- l'owner ne l'a pas révoquée à la main (cf. enforce_horse_collaborator_quota).
drop policy if exists "horse_collaborators_invitee_accept" on public.horse_collaborators;
create policy "horse_collaborators_invitee_accept" on public.horse_collaborators
  for update using (
    lower("invitedEmail") = lower(auth.jwt() ->> 'email')
    and ("expiresAt" is null or "expiresAt" > now())
  )
  with check (lower("invitedEmail") = lower(auth.jwt() ->> 'email') and "collaboratorUserId" = auth.uid()::text);

-- Correctifs de sécurité du 2026-09-25 (cf. security-patch-2026-09-25.sql) ---

-- 1. Invitations de partage : un INVITÉ ne peut que les accepter ----------------
-- La policy horse_collaborators_invitee_accept ne vérifiait que l'email et
-- collaboratorUserId du résultat : un invité pouvait, dans le même UPDATE,
-- réécrire "horseId" vers n'importe quel autre cheval (dont il connaît l'id,
-- ex. une ancienne demi-pension) et en obtenir l'accès complet via
-- can_access_horse — ou changer son rôle, ou repousser l'expiration.
create or replace function public.protect_horse_collaborator_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Backend (Prisma, auth.uid() nul) ou propriétaire du cheval : règles
  -- habituelles (la policy owner_update impose déjà un cheval possédé).
  if auth.uid() is null or public.owns_horse(old."horseId") then
    return new;
  end if;
  -- Gérant (Écurie Pro v2) : change le rôle ou renouvelle une invitation,
  -- rien d'autre — ni le cheval, ni la personne, ni l'acceptation. Les
  -- policies lui interdisent déjà les lignes de gérant.
  if public.horse_can(old."horseId", 'manage_sharing') then
    if new."horseId" is distinct from old."horseId"
       or new."invitedEmail" is distinct from old."invitedEmail"
       or new.status is distinct from old.status
       or new."collaboratorUserId" is distinct from old."collaboratorUserId"
       or new."createdAt" is distinct from old."createdAt" then
      raise exception 'horse collaborator: a manager can only change the role or renew an invitation';
    end if;
    return new;
  end if;
  -- Invité : seule l'acceptation est permise — statut ACCEPTED, pour
  -- soi-même, sans rien toucher d'autre (updatedAt excepté).
  if new."horseId" is distinct from old."horseId"
     or new."invitedEmail" is distinct from old."invitedEmail"
     or new.role is distinct from old.role
     or new."expiresAt" is distinct from old."expiresAt"
     or new."createdAt" is distinct from old."createdAt"
     or new.status <> 'ACCEPTED'
     or new."collaboratorUserId" is distinct from auth.uid()::text then
    raise exception 'horse collaborator: only acceptance is allowed for the invitee';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_horse_collaborator_update on public.horse_collaborators;
create trigger protect_horse_collaborator_update
  before update on public.horse_collaborators
  for each row execute function public.protect_horse_collaborator_update();

-- Limite des emails d'invitation (cf. invite-email-throttle-2026-09-27.sql).
-- Seul le backend (connexion Prisma, auth.uid() nul) écrit cette colonne :
-- via l'API Supabase, elle est ignorée à l'insertion et conservée à la mise à
-- jour, pour qu'un propriétaire ne puisse pas la remettre à zéro.
create or replace function public.protect_invite_email_sent_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new."inviteEmailSentAt" := null;
    else
      new."inviteEmailSentAt" := old."inviteEmailSentAt";
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_invite_email_sent_at on public.horse_collaborators;
create trigger protect_invite_email_sent_at
  before insert or update on public.horse_collaborators
  for each row execute function public.protect_invite_email_sent_at();

-- 2. users.email n'est plus modifiable depuis l'app -----------------------------
-- La policy users_update_own laissait un utilisateur réécrire son email dans
-- public.users. Le backend s'en servait comme destinataire des rappels email
-- (contenu libre) : n'importe qui pouvait faire envoyer des emails depuis le
-- domaine Horsetrack à une adresse tierce. Le backend lit désormais l'email
-- de Supabase Auth (cf. apps/api/src/lib/supabaseAdmin.ts getAuthEmail) ; ce
-- trigger ferme la porte en défense en profondeur.
create or replace function public.protect_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_email on public.users;
create trigger protect_user_email
  before update on public.users
  for each row execute function public.protect_user_email();

-- training_sessions, training_session_rides, horse_details (planning et fiche,
-- palier gratuit) : section « droits-par-role » en fin de fichier.

-- rider_contacts : carnet personnel.
drop policy if exists "rider_contacts_own" on public.rider_contacts;
create policy "rider_contacts_own" on public.rider_contacts
  for all using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- expenses, horse_weight_measurements (palier gratuit) : section « droits-par-role ».

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

-- 6. Storage : bucket "horse-photos" (photo de profil du cheval + photo de
-- journal Premium) -----------------------------------------------------------
-- Bucket privé comme "documents", mais scoping différent : une photo de
-- cheval doit rester visible par le propriétaire ET par les collaborateurs
-- acceptés (même règle que la lecture de la fiche cheval, cf.
-- horses_select_shared plus haut) — donc scoping par horseId (premier segment
-- du chemin "{horseId}/photo.jpg"), pas par auth.uid() comme documents.
-- Écriture réservée au propriétaire (owns_horse) — lecture ouverte à
-- can_access_horse via une policy SELECT séparée (policies permissives
-- combinées en OR, même pattern que horses_select_shared).
--
-- Photo de journal (cf. audit sécurité pré-release du 2026-09-07) : chemin
-- "{horseId}/journal/{entryId}.jpg" (deuxième segment "journal", cf.
-- uploadJournalPhoto dans cloudSync.ts) — jusqu'ici la seule policy d'écriture
-- ("horse_photos_write_own", "for all") ne vérifiait QUE owns_horse, jamais le
-- palier d'abonnement : un compte Free contournant l'app (appel direct à
-- l'API Storage avec son propre token) pouvait donc uploader une photo de
-- journal alors que la fonctionnalité est réservée au Premium (restriction
-- jusque-là purement côté UI, cf. Locked dans JournalForm.tsx — voir aussi
-- protect_journal_entry_photo_premium plus haut, même défense côté table
-- journal_entries). Remplacée par 3 policies granulaires : la photo de profil
-- ("{horseId}/photo.jpg", pas de deuxième segment — (storage.foldername(name))[2]
-- vaut alors NULL, distinct de 'journal') reste accessible à tout propriétaire,
-- Free ou Premium ; seul le sous-dossier "journal/" est gaté, et seulement à
-- l'insert/update (un nouvel upload/remplacement) — la suppression n'est PAS
-- gatée Premium : un compte redevenu Free doit pouvoir nettoyer/supprimer sa
-- propre photo de journal existante (deleteJournalEntryRemote doit toujours
-- pouvoir réussir).
drop policy if exists "horse_photos_write_own" on storage.objects;

drop policy if exists "horse_photos_insert_own" on storage.objects;
create policy "horse_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'horse-photos'
    and public.owns_horse((storage.foldername(name))[1])
    and (
      (storage.foldername(name))[2] is distinct from 'journal'
      or public.horse_owner_is_active_or_trialing((storage.foldername(name))[1])
    )
  );

drop policy if exists "horse_photos_update_own" on storage.objects;
create policy "horse_photos_update_own" on storage.objects
  for update using (bucket_id = 'horse-photos' and public.owns_horse((storage.foldername(name))[1]))
  with check (
    bucket_id = 'horse-photos'
    and public.owns_horse((storage.foldername(name))[1])
    and (
      (storage.foldername(name))[2] is distinct from 'journal'
      or public.horse_owner_is_active_or_trialing((storage.foldername(name))[1])
    )
  );

drop policy if exists "horse_photos_delete_own" on storage.objects;
create policy "horse_photos_delete_own" on storage.objects
  for delete using (bucket_id = 'horse-photos' and public.owns_horse((storage.foldername(name))[1]));

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

-- Bloc C (cf. bloc-c-2026-10-28.sql) -------------------------------------------
-- Coach IA et jetons push : réservés à l'API, RLS sans aucune policy.
alter table public.coach_calls enable row level security;
alter table public.coach_suggestions enable row level security;
alter table public.coach_summaries enable row level security;
alter table public.push_tokens enable row level security;

-- Fil privé d'un cheval : mêmes personnes que le cheval (can_access_horse).
-- Rôle de l'auteur posé par la base, jamais par l'app : une demi-pension ne
-- peut pas se présenter comme propriétaire.
create or replace function public.set_horse_comment_author_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new."authorUserId" := auth.uid()::text;
  if public.owns_horse(new."horseId") then
    new."authorRole" := 'OWNER';
  else
    select hc.role::text into new."authorRole"
    from public.horse_collaborators hc
    where hc."horseId" = new."horseId"
      and hc."collaboratorUserId" = auth.uid()::text
      and hc.status = 'ACCEPTED'
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists horse_comments_set_author_role on public.horse_comments;
create trigger horse_comments_set_author_role
  before insert on public.horse_comments
  for each row execute function public.set_horse_comment_author_role();

alter table public.horse_comments enable row level security;
alter table public.horse_reactions enable row level security;
alter table public.comment_reports enable row level security;

drop policy if exists "horse_comments_select_shared" on public.horse_comments;
create policy "horse_comments_select_shared" on public.horse_comments
  for select using (public.can_access_horse("horseId"));
drop policy if exists "horse_comments_insert_shared" on public.horse_comments;
create policy "horse_comments_insert_shared" on public.horse_comments
  for insert with check (public.can_access_horse("horseId"));
-- Pas de modification : un commentaire se supprime et se réécrit.
-- Suppression : son auteur, ou le propriétaire du cheval (modération).

drop policy if exists "horse_reactions_select_shared" on public.horse_reactions;
create policy "horse_reactions_select_shared" on public.horse_reactions
  for select using (public.can_access_horse("horseId"));
drop policy if exists "horse_reactions_insert_own" on public.horse_reactions;
create policy "horse_reactions_insert_own" on public.horse_reactions
  for insert with check ("userId" = auth.uid()::text and public.can_access_horse("horseId"));
drop policy if exists "horse_reactions_delete_own" on public.horse_reactions;
create policy "horse_reactions_delete_own" on public.horse_reactions
  for delete using ("userId" = auth.uid()::text);

-- Signalement : n'importe quel participant du fil, sur un commentaire qu'il
-- peut lire ; lu seulement depuis la console /admin (API).
drop policy if exists "comment_reports_insert_participant" on public.comment_reports;
create policy "comment_reports_insert_participant" on public.comment_reports
  for insert with check (
    "reporterUserId" = auth.uid()::text
    and exists (
      select 1 from public.horse_comments c
      where c.id = "commentId" and public.can_access_horse(c."horseId")
    )
  );

-- >>> droits-par-role (Écurie Pro v2, 2026-11-08)
-- Droits par rôle sur un cheval partagé. Jusqu'ici can_access_horse donnait à
-- tout invité accepté les mêmes droits d'écriture que le propriétaire (une
-- demi-pension pouvait supprimer un soin ou une dépense). Désormais :
--   * horse_role(cheval)            : 'OWNER', le rôle du collaborateur accepté, ou null ;
--   * horse_role_can(rôle, droit)   : LA matrice des droits (recopiée dans
--     apps/mobile/src/lib/permissions.ts, un test vérifie qu'elles concordent) ;
--   * horse_can(cheval, droit)      : les deux réunis, pour les policies ;
--   * "createdByUserId"             : auteur d'une ligne, posé par la base
--     (set_created_by), jamais par l'app — sert aux droits « les siens ».
-- La lecture reste ouverte à toute l'équipe du cheval (can_access_horse),
-- sauf les dépenses.

create or replace function public.horse_role(_horse_id text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null then null
    when public.owns_horse(_horse_id) then 'OWNER'
    else (
      select hc.role::text
      from public.horse_collaborators hc
      where hc."horseId" = _horse_id
        and hc."collaboratorUserId" = auth.uid()::text
        and hc.status = 'ACCEPTED'
      limit 1
    )
  end;
$$;

-- Matrice des droits. Une ligne par droit, rôles entre parenthèses : format
-- lu par apps/mobile/src/lib/permissions.test.ts, à garder tel quel.
create or replace function public.horse_role_can(_role text, _cap text)
returns boolean
language sql
immutable
as $$
  select coalesce(case _cap
    when 'read'                then _role in ('OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER', 'GROOM', 'VET', 'FARRIER')
    when 'edit_details'        then _role in ('OWNER', 'MANAGER')
    when 'manage_sharing'      then _role in ('OWNER', 'MANAGER')
    when 'manage_sessions'     then _role in ('OWNER', 'MANAGER', 'COACH')
    when 'own_sessions'        then _role in ('OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER')
    when 'manage_care'         then _role in ('OWNER', 'MANAGER')
    when 'add_care'            then _role in ('OWNER', 'MANAGER', 'GROOM', 'VET', 'FARRIER')
    when 'manage_competitions' then _role in ('OWNER', 'MANAGER', 'COACH')
    when 'manage_journal'      then _role in ('OWNER', 'MANAGER')
    when 'add_journal'         then _role in ('OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER', 'GROOM', 'VET', 'FARRIER')
    when 'manage_expenses'     then _role in ('OWNER', 'MANAGER')
    when 'moderate'            then _role in ('OWNER', 'MANAGER')
    when 'manage_planning'     then _role in ('OWNER', 'MANAGER', 'COACH')
    else false
  end, false);
$$;

create or replace function public.horse_can(_horse_id text, _cap text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.horse_role_can(public.horse_role(_horse_id), _cap);
$$;

-- « Tout » avec le droit `_manage`, ou « les siens » avec le droit `_own`.
create or replace function public.horse_can_write(_horse_id text, _manage text, _own text, _created_by text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  -- coalesce : une ligne sans auteur (antérieure) donnerait null, pas false.
  select public.horse_can(_horse_id, _manage)
    or coalesce(_created_by = auth.uid()::text and public.horse_can(_horse_id, _own), false);
$$;

-- Rendez-vous : un concours relève du sportif (coach compris), tout autre
-- type relève des soins.
create or replace function public.can_write_appointment(_horse_id text, _type text, _created_by text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when _type = 'CONCOURS' then public.horse_can(_horse_id, 'manage_competitions')
    else public.horse_can_write(_horse_id, 'manage_care', 'add_care', _created_by)
  end;
$$;

-- Séance : toutes pour le coach et le gérant ; les siennes (créées par soi)
-- pour une demi-pension ou un cavalier.
create or replace function public.can_write_session(_horse_id text, _created_by text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.horse_can_write(_horse_id, 'manage_sessions', 'own_sessions', _created_by);
$$;

-- Parcours GPS : mêmes droits que sa séance (qui existe forcément : clé
-- étrangère sessionId). Élargie au cavalier attribué dans « planning-seances ».
create or replace function public.can_write_session_ride(_session_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.can_write_session(s."horseId", s."createdByUserId")
       from public.training_sessions s where s.id = _session_id),
    false
  );
$$;

revoke execute on function public.horse_role(text) from public, anon;
revoke execute on function public.horse_can(text, text) from public, anon;
revoke execute on function public.horse_can_write(text, text, text, text) from public, anon;
revoke execute on function public.can_write_appointment(text, text, text) from public, anon;
revoke execute on function public.can_write_session(text, text) from public, anon;
revoke execute on function public.can_write_session_ride(text) from public, anon;
grant execute on function public.horse_role(text) to authenticated, service_role;
grant execute on function public.horse_can(text, text) to authenticated, service_role;
grant execute on function public.horse_can_write(text, text, text, text) to authenticated, service_role;
grant execute on function public.can_write_appointment(text, text, text) to authenticated, service_role;
grant execute on function public.can_write_session(text, text) to authenticated, service_role;
grant execute on function public.can_write_session_ride(text) to authenticated, service_role;

-- Auteur d'une ligne : celui qui l'insère (via l'API Supabase), immuable
-- ensuite. Le backend (auth.uid() nul) garde la valeur qu'il fournit. Les
-- lignes antérieures restent sans auteur : seuls le propriétaire et le
-- gérant peuvent alors les modifier.
create or replace function public.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new."createdByUserId" := auth.uid()::text;
    end if;
  else
    new."createdByUserId" := old."createdByUserId";
  end if;
  return new;
end;
$$;

drop trigger if exists set_created_by on public.appointments;
create trigger set_created_by before insert or update on public.appointments
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.journal_entries;
create trigger set_created_by before insert or update on public.journal_entries
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.training_sessions;
create trigger set_created_by before insert or update on public.training_sessions
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.expenses;
create trigger set_created_by before insert or update on public.expenses
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.horse_weight_measurements;
create trigger set_created_by before insert or update on public.horse_weight_measurements
  for each row execute function public.set_created_by();

-- appointments ---------------------------------------------------------------
drop policy if exists "appointments_shared" on public.appointments;
drop policy if exists "appointments_select_shared" on public.appointments;
create policy "appointments_select_shared" on public.appointments
  for select using (public.can_access_horse("horseId"));
drop policy if exists "appointments_insert_shared" on public.appointments;
create policy "appointments_insert_shared" on public.appointments
  for insert with check (public.can_write_appointment("horseId", type::text, "createdByUserId"));
drop policy if exists "appointments_update_shared" on public.appointments;
create policy "appointments_update_shared" on public.appointments
  for update using (public.can_write_appointment("horseId", type::text, "createdByUserId"))
  with check (public.can_write_appointment("horseId", type::text, "createdByUserId"));
drop policy if exists "appointments_delete_shared" on public.appointments;
create policy "appointments_delete_shared" on public.appointments
  for delete using (public.can_write_appointment("horseId", type::text, "createdByUserId"));

-- competition_entries : épreuves d'un concours (Premium), droits du concours.
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
        and public.horse_can(a."horseId", 'manage_competitions')
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  );
drop policy if exists "competition_entries_update_shared" on public.competition_entries;
create policy "competition_entries_update_shared" on public.competition_entries
  for update using (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.horse_can(a."horseId", 'manage_competitions')
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  )
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.horse_can(a."horseId", 'manage_competitions')
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  );
drop policy if exists "competition_entries_delete_shared" on public.competition_entries;
create policy "competition_entries_delete_shared" on public.competition_entries
  for delete using (
    exists (
      select 1 from public.appointments a
      where a.id = "appointmentId"
        and public.horse_can(a."horseId", 'manage_competitions')
        and public.horse_owner_is_active_or_trialing(a."horseId")
    )
  );

-- journal_entries : toute l'équipe écrit ; chacun modifie les siennes.
drop policy if exists "journal_entries_shared" on public.journal_entries;
drop policy if exists "journal_entries_select_shared" on public.journal_entries;
create policy "journal_entries_select_shared" on public.journal_entries
  for select using (public.can_access_horse("horseId"));
drop policy if exists "journal_entries_insert_shared" on public.journal_entries;
create policy "journal_entries_insert_shared" on public.journal_entries
  for insert with check (public.horse_can("horseId", 'add_journal'));
drop policy if exists "journal_entries_update_shared" on public.journal_entries;
create policy "journal_entries_update_shared" on public.journal_entries
  for update using (public.horse_can_write("horseId", 'manage_journal', 'add_journal', "createdByUserId"))
  with check (public.horse_can_write("horseId", 'manage_journal', 'add_journal', "createdByUserId"));
drop policy if exists "journal_entries_delete_shared" on public.journal_entries;
create policy "journal_entries_delete_shared" on public.journal_entries
  for delete using (public.horse_can_write("horseId", 'manage_journal', 'add_journal', "createdByUserId"));

-- training_sessions ----------------------------------------------------------
drop policy if exists "training_sessions_shared" on public.training_sessions;
drop policy if exists "training_sessions_select_shared" on public.training_sessions;
create policy "training_sessions_select_shared" on public.training_sessions
  for select using (public.can_access_horse("horseId"));
drop policy if exists "training_sessions_insert_shared" on public.training_sessions;
create policy "training_sessions_insert_shared" on public.training_sessions
  for insert with check (public.can_write_session("horseId", "createdByUserId"));
-- Élargie au cavalier attribué dans « planning-seances ».
drop policy if exists "training_sessions_update_shared" on public.training_sessions;
create policy "training_sessions_update_shared" on public.training_sessions
  for update using (public.can_write_session("horseId", "createdByUserId"))
  with check (public.can_write_session("horseId", "createdByUserId"));
drop policy if exists "training_sessions_delete_shared" on public.training_sessions;
create policy "training_sessions_delete_shared" on public.training_sessions
  for delete using (public.can_write_session("horseId", "createdByUserId"));

drop policy if exists "training_session_rides_select_shared" on public.training_session_rides;
create policy "training_session_rides_select_shared" on public.training_session_rides
  for select using (public.can_access_horse("horseId"));
drop policy if exists "training_session_rides_insert_shared" on public.training_session_rides;
create policy "training_session_rides_insert_shared" on public.training_session_rides
  for insert with check (public.can_write_session_ride("sessionId"));
drop policy if exists "training_session_rides_update_shared" on public.training_session_rides;
create policy "training_session_rides_update_shared" on public.training_session_rides
  for update using (public.can_write_session_ride("sessionId"))
  with check (public.can_write_session_ride("sessionId"));
drop policy if exists "training_session_rides_delete_shared" on public.training_session_rides;
create policy "training_session_rides_delete_shared" on public.training_session_rides
  for delete using (public.can_write_session_ride("sessionId"));

-- horse_details : identité, alimentation, demi-pension — lue par l'équipe,
-- écrite par le propriétaire et le gérant.
drop policy if exists "horse_details_select_shared" on public.horse_details;
create policy "horse_details_select_shared" on public.horse_details
  for select using (public.can_access_horse("horseId"));
drop policy if exists "horse_details_insert_shared" on public.horse_details;
create policy "horse_details_insert_shared" on public.horse_details
  for insert with check (public.horse_can("horseId", 'edit_details'));
drop policy if exists "horse_details_update_shared" on public.horse_details;
create policy "horse_details_update_shared" on public.horse_details
  for update using (public.horse_can("horseId", 'edit_details'))
  with check (public.horse_can("horseId", 'edit_details'));
drop policy if exists "horse_details_delete_shared" on public.horse_details;
create policy "horse_details_delete_shared" on public.horse_details
  for delete using (public.horse_can("horseId", 'edit_details'));

-- expenses : propriétaire et gérant seulement, lecture comprise.
drop policy if exists "expenses_shared" on public.expenses;
drop policy if exists "expenses_select_shared" on public.expenses;
create policy "expenses_select_shared" on public.expenses
  for select using (public.horse_can("horseId", 'manage_expenses'));
drop policy if exists "expenses_insert_shared" on public.expenses;
create policy "expenses_insert_shared" on public.expenses
  for insert with check (public.horse_can("horseId", 'manage_expenses'));
drop policy if exists "expenses_update_shared" on public.expenses;
create policy "expenses_update_shared" on public.expenses
  for update using (public.horse_can("horseId", 'manage_expenses'))
  with check (public.horse_can("horseId", 'manage_expenses'));
drop policy if exists "expenses_delete_shared" on public.expenses;
create policy "expenses_delete_shared" on public.expenses
  for delete using (public.horse_can("horseId", 'manage_expenses'));

-- horse_weight_measurements : un soin courant (groom, véto compris).
drop policy if exists "horse_weight_measurements_select_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_select_shared" on public.horse_weight_measurements
  for select using (public.can_access_horse("horseId"));
drop policy if exists "horse_weight_measurements_insert_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_insert_shared" on public.horse_weight_measurements
  for insert with check (public.horse_can("horseId", 'add_care'));
drop policy if exists "horse_weight_measurements_update_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_update_shared" on public.horse_weight_measurements
  for update using (public.horse_can_write("horseId", 'manage_care', 'add_care', "createdByUserId"))
  with check (public.horse_can_write("horseId", 'manage_care', 'add_care', "createdByUserId"));
drop policy if exists "horse_weight_measurements_delete_shared" on public.horse_weight_measurements;
create policy "horse_weight_measurements_delete_shared" on public.horse_weight_measurements
  for delete using (public.horse_can_write("horseId", 'manage_care', 'add_care', "createdByUserId"));

-- horse_collaborators : le gérant gère l'équipe comme le propriétaire, sauf
-- les gérants (ni en nommer, ni en modifier, ni en retirer un autre que soi).
drop policy if exists "horse_collaborators_owner_select" on public.horse_collaborators;
create policy "horse_collaborators_owner_select" on public.horse_collaborators
  for select using (public.horse_can("horseId", 'manage_sharing'));

drop policy if exists "horse_collaborators_owner_update" on public.horse_collaborators;
create policy "horse_collaborators_owner_update" on public.horse_collaborators
  for update using (
    public.owns_horse("horseId")
    or (public.horse_can("horseId", 'manage_sharing') and role <> 'MANAGER')
  )
  with check (
    public.owns_horse("horseId")
    or (public.horse_can("horseId", 'manage_sharing') and role <> 'MANAGER')
  );

drop policy if exists "horse_collaborators_owner_delete" on public.horse_collaborators;
create policy "horse_collaborators_owner_delete" on public.horse_collaborators
  for delete using (
    public.owns_horse("horseId")
    or (public.horse_can("horseId", 'manage_sharing') and role <> 'MANAGER')
    or "collaboratorUserId" = auth.uid()::text
  );

drop policy if exists "horse_collaborators_owner_insert" on public.horse_collaborators;
create policy "horse_collaborators_owner_insert" on public.horse_collaborators
  for insert with check (
    (public.owns_horse("horseId") or (public.horse_can("horseId", 'manage_sharing') and role <> 'MANAGER'))
    and public.horse_owner_is_active_or_trialing("horseId")
    -- Même exclusion des invitations PENDING expirées que enforce_horse_collaborator_quota
    -- (le WITH CHECK seul ne ferme pas la course, d'où le trigger).
    and (
      select count(*) from public.horse_collaborators hc2
      where hc2."horseId" = "horseId"
        and (hc2.status = 'ACCEPTED' or hc2."expiresAt" is null or hc2."expiresAt" > now())
    ) < public.horse_collaborator_limit("horseId")
  );

-- Fil : un commentaire se supprime par son auteur ou par un modérateur.
drop policy if exists "horse_comments_delete_author_or_owner" on public.horse_comments;
create policy "horse_comments_delete_author_or_owner" on public.horse_comments
  for delete using ("authorUserId" = auth.uid()::text or public.horse_can("horseId", 'moderate'));
-- <<< droits-par-role

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
