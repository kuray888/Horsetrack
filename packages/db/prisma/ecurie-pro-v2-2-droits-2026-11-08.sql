-- Écurie Pro v2, étape 2/2 (2026-11-08) — à exécuter APRÈS l'étape 1, dans
-- l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql (section
-- « droits-par-role » et protect_horse_collaborator_update) : un test
-- (tests/rls/run.sh) vérifie qu'elles restent identiques.
--
-- Droits par rôle sur un cheval partagé : une demi-pension ne peut plus
-- supprimer un soin, ni voir les dépenses ; le gérant gère l'équipe.
-- Les anciennes versions de l'app continuent de fonctionner : une écriture
-- refusée est signalée et retirée de leur file de synchronisation.

alter table public.appointments add column if not exists "createdByUserId" text;
alter table public.journal_entries add column if not exists "createdByUserId" text;
alter table public.training_sessions add column if not exists "createdByUserId" text;
alter table public.expenses add column if not exists "createdByUserId" text;
alter table public.horse_weight_measurements add column if not exists "createdByUserId" text;

-- Anciens partages : tous ceux qui existent à cet instant gardent leurs droits
-- d'avant (accès complet au cheval, sauf l'équipe). Fait UNE fois : une
-- relance du script ne redonne rien à ceux dont le propriétaire a appliqué
-- les droits de leur rôle.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'horse_collaborators' and column_name = 'fullAccess'
  ) then
    alter table public.horse_collaborators add column "fullAccess" boolean not null default false;
    update public.horse_collaborators set "fullAccess" = true;
  end if;
end $$;

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
      select case when hc."fullAccess" then 'LEGACY' else hc.role::text end
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
    when 'read'                then _role in ('LEGACY', 'OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER', 'GROOM', 'VET', 'FARRIER')
    when 'edit_details'        then _role in ('LEGACY', 'OWNER', 'MANAGER')
    when 'manage_sharing'      then _role in ('OWNER', 'MANAGER')
    when 'manage_sessions'     then _role in ('LEGACY', 'OWNER', 'MANAGER', 'COACH')
    when 'own_sessions'        then _role in ('LEGACY', 'OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER')
    when 'manage_care'         then _role in ('LEGACY', 'OWNER', 'MANAGER')
    when 'add_care'            then _role in ('LEGACY', 'OWNER', 'MANAGER', 'GROOM', 'VET', 'FARRIER')
    when 'manage_competitions' then _role in ('LEGACY', 'OWNER', 'MANAGER', 'COACH')
    when 'manage_journal'      then _role in ('LEGACY', 'OWNER', 'MANAGER')
    when 'add_journal'         then _role in ('LEGACY', 'OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER', 'GROOM', 'VET', 'FARRIER')
    when 'manage_expenses'     then _role in ('LEGACY', 'OWNER', 'MANAGER')
    when 'moderate'            then _role in ('OWNER', 'MANAGER')
    when 'manage_fees'         then _role in ('OWNER', 'MANAGER')
    when 'manage_tasks'        then _role in ('OWNER', 'MANAGER', 'GROOM')
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

-- Anciens partages (« fullAccess ») : les personnes déjà invitées avant les
-- droits par rôle gardent exactement leurs droits d'alors, jusqu'à ce que le
-- propriétaire applique ceux de leur rôle (écran Équipe). Posé une seule fois
-- par la migration ; l'app ne peut ni l'accorder à une nouvelle invitation ni
-- le redonner après l'avoir retiré.
create or replace function public.protect_full_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new."fullAccess" := false;
  else
    new."fullAccess" := old."fullAccess" and new."fullAccess";
  end if;
  return new;
end;
$$;

drop trigger if exists protect_full_access on public.horse_collaborators;
create trigger protect_full_access
  before insert or update on public.horse_collaborators
  for each row execute function public.protect_full_access();
-- <<< droits-par-role
