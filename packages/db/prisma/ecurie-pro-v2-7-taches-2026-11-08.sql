-- Écurie Pro v2, étape 7 (2026-11-08) — à exécuter APRÈS les étapes 1 à 6,
-- dans l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql
-- (section « taches ») : tests/rls/run.sh vérifie qu'elles restent
-- identiques.

create table if not exists public.stable_tasks (
  id text primary key,
  "horseId" text not null references public.horses(id) on delete cascade on update cascade,
  title text not null,
  "assigneeUserId" text,
  "assigneeName" text,
  weekdays integer[] not null default '{}',
  "dueDate" timestamp(3),
  "time" text,
  notes text not null default '',
  "validFrom" timestamp(3) not null,
  "validUntil" timestamp(3),
  "createdByUserId" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);
create index if not exists "stable_tasks_horseId_idx" on public.stable_tasks ("horseId");
create index if not exists "stable_tasks_assigneeUserId_idx" on public.stable_tasks ("assigneeUserId");

create table if not exists public.stable_task_completions (
  id text primary key,
  "taskId" text not null references public.stable_tasks(id) on delete cascade on update cascade,
  "horseId" text not null,
  date timestamp(3) not null,
  "doneByUserId" text,
  "doneAt" timestamp(3) not null default current_timestamp
);
create index if not exists "stable_task_completions_taskId_idx" on public.stable_task_completions ("taskId");
create index if not exists "stable_task_completions_horseId_date_idx" on public.stable_task_completions ("horseId", date);
grant all on public.stable_tasks, public.stable_task_completions to authenticated, service_role;

-- >>> taches (Écurie Pro v2, 2026-11-08)
-- Tâches d'écurie : créées par le propriétaire, le gérant et le groom d'un
-- compte Écurie Pro ; cochées par la personne chargée de la tâche ou par
-- eux ; lues par toute l'équipe, y compris après la fin de Pro. Qui a coché
-- et quand : posés par la base. Les anciens partages (LEGACY) n'y écrivent
-- pas : nouveauté.
alter table public.stable_tasks enable row level security;
alter table public.stable_task_completions enable row level security;

drop policy if exists "stable_tasks_select" on public.stable_tasks;
create policy "stable_tasks_select" on public.stable_tasks
  for select using (public.can_access_horse("horseId"));
drop policy if exists "stable_tasks_insert" on public.stable_tasks;
create policy "stable_tasks_insert" on public.stable_tasks
  for insert with check (public.horse_can("horseId", 'manage_tasks') and public.horse_owner_is_pro("horseId"));
drop policy if exists "stable_tasks_update" on public.stable_tasks;
create policy "stable_tasks_update" on public.stable_tasks
  for update using (public.horse_can("horseId", 'manage_tasks') and public.horse_owner_is_pro("horseId"))
  with check (public.horse_can("horseId", 'manage_tasks') and public.horse_owner_is_pro("horseId"));
drop policy if exists "stable_tasks_delete" on public.stable_tasks;
create policy "stable_tasks_delete" on public.stable_tasks
  for delete using (public.horse_can("horseId", 'manage_tasks') and public.horse_owner_is_pro("horseId"));

drop trigger if exists set_created_by on public.stable_tasks;
create trigger set_created_by before insert or update on public.stable_tasks
  for each row execute function public.set_created_by();

create or replace function public.stable_task_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(new.title)) = 0 or length(new.title) > 120 then
    raise exception 'stable task: title must be 1 to 120 characters';
  end if;
  if exists (select 1 from unnest(new.weekdays) d where d < 1 or d > 7) then
    raise exception 'stable task: weekdays must be 1 (Monday) to 7 (Sunday)';
  end if;
  if new."assigneeUserId" is not null
     and (tg_op = 'INSERT' or new."assigneeUserId" is distinct from old."assigneeUserId")
     and not public.is_horse_member(new."horseId", new."assigneeUserId") then
    raise exception 'stable task: assignee is not part of this horse''s team';
  end if;
  return new;
end;
$$;

drop trigger if exists stable_task_rules on public.stable_tasks;
create trigger stable_task_rules
  before insert or update on public.stable_tasks
  for each row execute function public.stable_task_rules();

-- Cocher : la personne chargée de la tâche, ou qui gère les tâches du cheval.
create or replace function public.can_complete_task(_task_id text, _horse_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.stable_tasks t
    where t.id = _task_id
      and t."horseId" = _horse_id
      and public.can_access_horse(t."horseId")
      and public.horse_owner_is_pro(t."horseId")
      and (public.horse_can(t."horseId", 'manage_tasks') or t."assigneeUserId" = auth.uid()::text)
  );
$$;

revoke execute on function public.can_complete_task(text, text) from public, anon;
grant execute on function public.can_complete_task(text, text) to authenticated, service_role;

drop policy if exists "stable_task_completions_select" on public.stable_task_completions;
create policy "stable_task_completions_select" on public.stable_task_completions
  for select using (public.can_access_horse("horseId"));
drop policy if exists "stable_task_completions_insert" on public.stable_task_completions;
create policy "stable_task_completions_insert" on public.stable_task_completions
  for insert with check (public.can_complete_task("taskId", "horseId"));
drop policy if exists "stable_task_completions_delete" on public.stable_task_completions;
create policy "stable_task_completions_delete" on public.stable_task_completions
  for delete using (public.can_complete_task("taskId", "horseId"));

create or replace function public.stable_task_completion_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new."doneByUserId" := auth.uid()::text;
    new."doneAt" := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stable_task_completion_rules on public.stable_task_completions;
create trigger stable_task_completion_rules
  before insert on public.stable_task_completions
  for each row execute function public.stable_task_completion_rules();
-- <<< taches
