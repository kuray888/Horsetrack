-- Invitation gratuite d'une personne en lecture seule (2026-11-13). À exécuter
-- avant de publier la version de l'app qui la propose. Rejouable, sans effet sur
-- les partages existants (aucun n'a le rôle VIEWER ; leurs droits ne changent pas).

alter type public.horse_collaborator_role add value if not exists 'VIEWER';

-- >>> invitation-gratuite
-- Invitation gratuite (2026-11-13) : un compte gratuit peut inviter UNE
-- personne par cheval, en lecture seule (rôle VIEWER). Les autres rôles, qui
-- écrivent, restent Premium. Placé en fin de fichier : remplace la fonction
-- horse_role_can et la règle d'invitation posées dans la section
-- droits-par-role (déjà recopiée en production, à ne pas modifier).
-- `role::text` : la valeur VIEWER peut avoir été ajoutée dans la même
-- transaction (migration), où l'enum ne l'accepte pas encore.
create or replace function public.horse_role_can(_role text, _cap text)
returns boolean
language sql
immutable
as $$
  select coalesce(case _cap
    when 'read'                then _role in ('LEGACY', 'OWNER', 'MANAGER', 'COACH', 'DEMI_PENSION', 'RIDER', 'GROOM', 'VET', 'FARRIER', 'VIEWER')
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

drop policy if exists "horse_collaborators_owner_insert" on public.horse_collaborators;
create policy "horse_collaborators_owner_insert" on public.horse_collaborators
  for insert with check (
    (public.owns_horse("horseId") or (public.horse_can("horseId", 'manage_sharing') and role <> 'MANAGER'))
    and (public.horse_owner_is_active_or_trialing("horseId") or role::text = 'VIEWER')
    and (
      select count(*) from public.horse_collaborators hc2
      where hc2."horseId" = "horseId"
        and (hc2.status = 'ACCEPTED' or hc2."expiresAt" is null or hc2."expiresAt" > now())
    ) < public.horse_collaborator_limit("horseId")
  );

-- Un invité en lecture seule ne devient un rôle qui écrit que si le
-- propriétaire a Premium (sinon : inviter gratuitement puis changer le rôle).
create or replace function public.protect_viewer_upgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and old.role::text = 'VIEWER'
     and new.role::text <> 'VIEWER'
     and not public.horse_owner_is_active_or_trialing(new."horseId") then
    raise exception 'horse collaborator: a read-only invitation needs Premium to get more rights';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_viewer_upgrade on public.horse_collaborators;
create trigger protect_viewer_upgrade
  before update on public.horse_collaborators
  for each row execute function public.protect_viewer_upgrade();
-- <<< invitation-gratuite
