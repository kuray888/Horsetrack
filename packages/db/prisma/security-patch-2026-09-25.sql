-- Correctifs de sécurité du 2026-09-25 — à exécuter UNE fois dans l'éditeur
-- SQL Supabase (prod), après relecture. Idempotent (create or replace / drop
-- if exists). Également intégrés à rls.sql, qui reste la source de vérité.

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
