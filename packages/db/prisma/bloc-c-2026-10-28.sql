-- Bloc C du 2026-10-28 — à exécuter UNE fois dans l'éditeur SQL Supabase
-- (prod), après relecture. Idempotent, purement additif. Équivalent de
-- schema.prisma et de rls.sql.
--
-- Ordre : AVANT de déployer l'API qui contient le coach (ses routes lisent et
-- écrivent ces tables). Côté app, le fil privé et les notifications ne
-- s'affichent que si ces tables répondent.

-- ---------------------------------------------------------------------------
-- 1. Coach IA : journal des appels (sans contenu), suggestion du jour,
-- résumé du mois. Réservés à l'API : RLS activée, aucune policy.
create table if not exists public.coach_calls (
  "id"               text primary key,
  "userId"           text not null references public.users("id") on delete cascade,
  "kind"             text not null,
  "model"            text not null,
  "status"           text not null,
  "inputTokens"      integer not null default 0,
  "outputTokens"     integer not null default 0,
  "cacheReadTokens"  integer not null default 0,
  "cacheWriteTokens" integer not null default 0,
  "costMicros"       integer not null default 0,
  "errorCode"        text,
  "createdAt"        timestamp(3) not null default current_timestamp
);
create index if not exists coach_calls_user_created_idx on public.coach_calls ("userId", "createdAt");
create index if not exists coach_calls_created_idx on public.coach_calls ("createdAt");
alter table public.coach_calls enable row level security;

create table if not exists public.coach_suggestions (
  "id"        text primary key,
  "userId"    text not null references public.users("id") on delete cascade,
  "horseId"   text not null references public.horses("id") on delete cascade,
  "day"       text not null,
  "result"    jsonb not null,
  "createdAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists coach_suggestions_user_horse_day_key on public.coach_suggestions ("userId", "horseId", "day");
alter table public.coach_suggestions enable row level security;

create table if not exists public.coach_summaries (
  "id"        text primary key,
  "userId"    text not null references public.users("id") on delete cascade,
  "horseId"   text not null references public.horses("id") on delete cascade,
  "month"     text not null,
  "lang"      text not null default 'fr',
  "status"    text not null default 'PENDING',
  "facts"     jsonb,
  "batchId"   text,
  "summary"   text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists coach_summaries_user_horse_month_key on public.coach_summaries ("userId", "horseId", "month");
create index if not exists coach_summaries_status_idx on public.coach_summaries ("status");
alter table public.coach_summaries enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Fil privé d'un cheval : commentaires et réactions sur une séance ou un
-- souvenir, entre le propriétaire et les personnes avec qui il est partagé.
create table if not exists public.horse_comments (
  "id"           text primary key,
  "horseId"      text not null references public.horses("id") on delete cascade,
  "authorUserId" text not null references public.users("id") on delete cascade,
  "authorRole"   text not null default 'OWNER',
  "targetType"   text not null check ("targetType" in ('session', 'journal')),
  "targetId"     text not null,
  "body"         text not null check (char_length("body") between 1 and 1000),
  "createdAt"    timestamp(3) not null default current_timestamp
);
create index if not exists horse_comments_target_idx on public.horse_comments ("horseId", "targetType", "targetId");

create table if not exists public.horse_reactions (
  "id"         text primary key,
  "horseId"    text not null references public.horses("id") on delete cascade,
  "userId"     text not null references public.users("id") on delete cascade,
  "targetType" text not null check ("targetType" in ('session', 'journal')),
  "targetId"   text not null,
  "emoji"      text not null check ("emoji" in ('👏', '❤️', '💪', '😂', '😮')),
  "createdAt"  timestamp(3) not null default current_timestamp
);
create unique index if not exists horse_reactions_unique_key on public.horse_reactions ("targetType", "targetId", "userId", "emoji");
create index if not exists horse_reactions_horse_idx on public.horse_reactions ("horseId");

create table if not exists public.comment_reports (
  "id"             text primary key,
  "commentId"      text not null references public.horse_comments("id") on delete cascade,
  "reporterUserId" text not null,
  "reason"         text not null default '',
  "resolvedAt"     timestamp(3),
  "createdAt"      timestamp(3) not null default current_timestamp
);
create unique index if not exists comment_reports_unique_key on public.comment_reports ("commentId", "reporterUserId");

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
drop policy if exists "horse_comments_delete_author_or_owner" on public.horse_comments;
create policy "horse_comments_delete_author_or_owner" on public.horse_comments
  for delete using ("authorUserId" = auth.uid()::text or public.owns_horse("horseId"));

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

-- ---------------------------------------------------------------------------
-- 3. Jetons de notification push (Expo). Réservés à l'API (RLS sans policy) :
-- un même téléphone peut passer d'un compte à l'autre, et c'est l'API qui
-- rattache le jeton au bon compte (cf. apps/api /api/push/register).
create table if not exists public.push_tokens (
  "token"     text primary key,
  "userId"    text not null references public.users("id") on delete cascade,
  "platform"  text not null,
  "lang"      text not null default 'fr',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);
alter table public.push_tokens add column if not exists "lang" text not null default 'fr';
create index if not exists push_tokens_user_idx on public.push_tokens ("userId");
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_own" on public.push_tokens;
