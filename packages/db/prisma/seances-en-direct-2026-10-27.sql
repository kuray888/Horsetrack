-- Séances enregistrées en direct (chrono, GPS, allures) du 2026-10-27 — à
-- exécuter UNE fois dans l'éditeur SQL Supabase (prod), après relecture.
-- Idempotent. Purement additif : une nouvelle table, rien de modifié ailleurs.
-- Équivalent de schema.prisma (modèle TrainingSessionRide) et de rls.sql.
--
-- Ordre : avant ou après la mise en ligne de l'app, au choix. Tant que la
-- table manque, l'app garde les parcours sur le téléphone et les renvoie
-- d'elle-même une fois la table créée ; les séances, elles, se synchronisent
-- comme avant (table séparée, cf. apps/mobile/src/lib/cloudSync.ts).
--
-- Une ligne par séance enregistrée (id = id de la séance). Le tracé est une
-- polyligne encodée (cf. apps/mobile/src/rides/rideMath.ts), quelques Ko.
-- Supprimée avec sa séance ou son cheval (cascade).

create table if not exists public.training_session_rides (
  "id"              text primary key,
  "sessionId"       text not null references public.training_sessions("id") on delete cascade,
  "horseId"         text not null references public.horses("id") on delete cascade,
  "startedAt"       timestamp(3) not null,
  "endedAt"         timestamp(3) not null,
  "durationSeconds" integer not null,
  "distanceMeters"  integer not null default 0,
  "walkSeconds"     integer not null default 0,
  "trotSeconds"     integer not null default 0,
  "canterSeconds"   integer not null default 0,
  "haltSeconds"     integer not null default 0,
  "maxSpeedKmh"     double precision not null default 0,
  "avgSpeedKmh"     double precision not null default 0,
  "gps"             boolean not null default true,
  "route"           text,
  "createdAt"       timestamp(3) not null default current_timestamp,
  "updatedAt"       timestamp(3) not null
);

create unique index if not exists training_session_rides_session_key on public.training_session_rides ("sessionId");
create index if not exists training_session_rides_horse_idx on public.training_session_rides ("horseId");

alter table public.training_session_rides enable row level security;

-- Même portée de partage que training_sessions (cf. rls.sql) : un
-- demi-pensionnaire ou un coach voit le parcours d'une séance du cheval
-- partagé avec lui.
drop policy if exists "training_session_rides_select_shared" on public.training_session_rides;
create policy "training_session_rides_select_shared" on public.training_session_rides
  for select using (public.can_access_horse("horseId"));

drop policy if exists "training_session_rides_insert_shared" on public.training_session_rides;
create policy "training_session_rides_insert_shared" on public.training_session_rides
  for insert with check (public.can_access_horse("horseId"));

drop policy if exists "training_session_rides_update_shared" on public.training_session_rides;
create policy "training_session_rides_update_shared" on public.training_session_rides
  for update using (public.can_access_horse("horseId"))
  with check (public.can_access_horse("horseId"));

drop policy if exists "training_session_rides_delete_shared" on public.training_session_rides;
create policy "training_session_rides_delete_shared" on public.training_session_rides
  for delete using (public.can_access_horse("horseId"));

-- ---------------------------------------------------------------------------
-- Sécurité en balade (Premium) : partage de position avec des proches et
-- alerte quand le cavalier ne bouge plus. Lue et écrite UNIQUEMENT par l'API
-- (routes /api/ride-safety, page /suivi/<jeton>, cron /api/cron/ride-safety),
-- via la connexion Prisma directe : RLS activée sans aucune policy, donc
-- inaccessible depuis l'app — même principe que promo_codes.
--
-- L'id est le jeton du lien de suivi (aléatoire, 24 octets). Ne garde que la
-- DERNIÈRE position, jamais l'historique du trajet. Lignes purgées par le cron
-- 7 jours après la fin de la balade.

create table if not exists public.ride_shares (
  "id"               text primary key,
  "userId"           text not null references public.users("id") on delete cascade,
  "riderName"        text not null,
  "horseName"        text not null,
  "contacts"         jsonb not null,
  "status"           text not null default 'ACTIVE',
  "startedAt"        timestamp(3) not null default current_timestamp,
  "lastLat"          double precision,
  "lastLng"          double precision,
  "lastAccuracy"     double precision,
  "lastPointAt"      timestamp(3),
  "alertSentAt"      timestamp(3),
  "staleAlertSentAt" timestamp(3),
  "endedAt"          timestamp(3),
  "createdAt"        timestamp(3) not null default current_timestamp,
  "updatedAt"        timestamp(3) not null
);

alter table public.ride_shares
  drop constraint if exists ride_shares_status_check;
alter table public.ride_shares
  add constraint ride_shares_status_check check ("status" in ('ACTIVE', 'ALERT', 'ENDED'));

create index if not exists ride_shares_user_idx on public.ride_shares ("userId");
create index if not exists ride_shares_status_idx on public.ride_shares ("status");

alter table public.ride_shares enable row level security;
