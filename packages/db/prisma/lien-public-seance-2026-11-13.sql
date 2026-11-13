-- 1.3.0 : lien public d'une séance (« voir ma balade sur Horsetrack »), 2026-11-13.
-- À exécuter AVANT de déployer l'API. Additive et rejouable. Table réservée à l'API
-- (RLS activée SANS policy : ni anon ni authenticated n'y accèdent). Le cavalier
-- crée et supprime son lien depuis l'app ; la page publique /s/<jeton> ne montre
-- que ce qu'il a choisi d'envoyer (tracé déjà amputé du départ et de l'arrivée
-- s'il l'a demandé). Supprimée avec le compte (cascade).

create table if not exists public.public_rides (
  "id"              text primary key,
  "userId"          text not null references public.users("id") on delete cascade,
  "sessionId"       text,
  "horseName"       text not null default '',
  "activity"        text not null default '',
  "startedAt"       timestamp(3) not null,
  "durationSeconds" integer not null,
  "distanceMeters"  integer not null default 0,
  "avgSpeedKmh"     double precision not null default 0,
  "walkSeconds"     integer not null default 0,
  "trotSeconds"     integer not null default 0,
  "canterSeconds"   integer not null default 0,
  "route"           text,
  "endsHidden"      boolean not null default true,
  "createdAt"       timestamp(3) not null default current_timestamp
);

create index if not exists public_rides_user_idx on public.public_rides ("userId");
create index if not exists public_rides_session_idx on public.public_rides ("userId", "sessionId");

alter table public.public_rides enable row level security;
