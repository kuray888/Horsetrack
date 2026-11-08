-- Écurie Pro v2, étape 5 (2026-11-08) — à exécuter APRÈS les étapes 1 à 4,
-- dans l'éditeur SQL Supabase (prod). Idempotent.
--
-- Journal des notifications du planning (séance attribuée, « a monté »,
-- annulation) : une seule par événement et par personne.

create table if not exists public.planning_notifications (
  id text primary key,
  "senderUserId" text not null,
  "createdAt" timestamp(3) not null default current_timestamp
);
create index if not exists "planning_notifications_senderUserId_createdAt_idx"
  on public.planning_notifications ("senderUserId", "createdAt");

-- >>> notifications-planning (Écurie Pro v2, 2026-11-08)
-- Notifications du planning déjà envoyées : réservée à l'API (connexion
-- Prisma), RLS sans aucune policy, comme push_tokens.
alter table public.planning_notifications enable row level security;
-- <<< notifications-planning
