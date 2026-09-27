-- Limite des emails d'invitation (audit sécurité du 2026-09-27). À exécuter
-- UNE fois dans l'éditeur SQL Supabase (prod), après relecture, AVANT de
-- déployer l'API correspondante. Idempotent. Aussi reporté dans rls.sql.
--
-- /api/horse-invites pouvait être rappelée en boucle sur une même invitation :
-- un nombre illimité d'emails partait depuis notre domaine vers l'adresse
-- invitée (harcèlement, et risque de voir le domaine classé en spam).

alter table public.horse_collaborators
  add column if not exists "inviteEmailSentAt" timestamp(3);

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
