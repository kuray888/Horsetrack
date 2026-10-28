-- Bloc B du 2026-10-27 — à exécuter UNE fois dans l'éditeur SQL Supabase
-- (prod), après relecture. Idempotent, purement additif. Équivalent de
-- schema.prisma et de rls.sql.
--
-- Ordre : avant ou après la mise en ligne de l'app, au choix. Tant qu'une
-- table ou colonne manque, l'app garde ces données sur le téléphone et les
-- renvoie d'elle-même une fois le SQL exécuté (cf. apps/mobile/src/lib/cloudSync.ts,
-- upsertWithOptionalColumns) ; le reste se synchronise comme avant.

-- ---------------------------------------------------------------------------
-- 1. Nouveaux types de séance (travail à pied, liberté, cross, endurance, TREC,
-- pansage). L'enum activity_type n'est PAS modifié : une ancienne version de
-- l'app planterait sur une valeur inconnue. `activityType` garde le type de
-- base le plus proche, `activityKind` le type précis (cf.
-- apps/mobile/src/agenda/activityKinds.ts).
alter table public.training_sessions add column if not exists "activityKind" text;
alter table public.journal_entries add column if not exists "activityKind" text;

-- ---------------------------------------------------------------------------
-- 2. Identité et alimentation d'un cheval : une ligne par cheval, même portée
-- de partage que ses séances (le propriétaire et ses collaborateurs).
create table if not exists public.horse_details (
  "horseId"   text primary key references public.horses("id") on delete cascade,
  "identity"  jsonb not null default '{}'::jsonb,
  "feeding"   jsonb not null default '{}'::jsonb,
  -- Demi-pension (Premium) : prénom, jours, participation mensuelle.
  "partnership" jsonb not null default '{}'::jsonb,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

alter table public.horse_details add column if not exists "partnership" jsonb not null default '{}'::jsonb;

alter table public.horse_details enable row level security;

drop policy if exists "horse_details_select_shared" on public.horse_details;
create policy "horse_details_select_shared" on public.horse_details
  for select using (public.can_access_horse("horseId"));
drop policy if exists "horse_details_insert_shared" on public.horse_details;
create policy "horse_details_insert_shared" on public.horse_details
  for insert with check (public.can_access_horse("horseId"));
drop policy if exists "horse_details_update_shared" on public.horse_details;
create policy "horse_details_update_shared" on public.horse_details
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));
drop policy if exists "horse_details_delete_shared" on public.horse_details;
create policy "horse_details_delete_shared" on public.horse_details
  for delete using (public.can_access_horse("horseId"));

-- ---------------------------------------------------------------------------
-- 3. Carnet de contacts (véto, maréchal…) : personnel au cavalier.
create table if not exists public.rider_contacts (
  "id"        text primary key,
  "userId"    text not null references public.users("id") on delete cascade,
  "name"      text not null,
  "role"      text not null default 'autre',
  "phone"     text not null default '',
  "email"     text not null default '',
  "notes"     text not null default '',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create index if not exists rider_contacts_user_idx on public.rider_contacts ("userId");

alter table public.rider_contacts enable row level security;

drop policy if exists "rider_contacts_own" on public.rider_contacts;
create policy "rider_contacts_own" on public.rider_contacts
  for all using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 4. Vidéo d'un souvenir (Premium) : chemin Storage dans le bucket
-- "horse-photos", sous-dossier "journal/" — mêmes règles que la photo de
-- journal (propriétaire, Premium), rien à changer côté Storage. À vérifier
-- dans Supabase → Storage → horse-photos → réglages : si des types de
-- fichiers sont restreints, autoriser "video/mp4" ; limite de taille ≥ 50 Mo.
alter table public.journal_entries add column if not exists "videoPath" text;

-- Défense en profondeur, comme pour la photo : une vidéo ne s'ajoute à un
-- souvenir que sur un compte Premium (actif ou en essai), même par un appel
-- direct à l'API Supabase (cf. rls.sql protect_journal_entry_photo_premium,
-- remplacée ici à l'identique, vidéo en plus). Le déclencheur existant
-- appelle déjà cette fonction : rien d'autre à changer.
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

-- ---------------------------------------------------------------------------
-- 5. Parrainage : réservé à l'API (RLS sans policy, comme promo_codes).
create table if not exists public.referral_codes (
  "userId"    text primary key references public.users("id") on delete cascade,
  "code"      text not null unique,
  "createdAt" timestamp(3) not null default current_timestamp
);
alter table public.referral_codes enable row level security;

create table if not exists public.referral_uses (
  "refereeUserId"  text primary key,
  "referrerUserId" text not null,
  "code"           text not null,
  "rewardedAt"     timestamp(3),
  "createdAt"      timestamp(3) not null default current_timestamp
);
create index if not exists referral_uses_referrer_idx on public.referral_uses ("referrerUserId");
alter table public.referral_uses enable row level security;
