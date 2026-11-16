-- Quota d'invitations par cheval (2026-11-16) — à exécuter dans l'éditeur SQL
-- Supabase (prod) APRÈS invitation-gratuite-2026-11-13.sql. Idempotent.
--
-- Bug corrigé : dans la sous-requête de la règle d'insertion, "horseId" non
-- qualifié désignait hc2."horseId" (la colonne la plus proche) : la condition
-- comparait la colonne à elle-même et comptait les partenaires de TOUS les
-- chevaux visibles. Un propriétaire Premium ayant déjà invité quelqu'un sur un
-- cheval ne pouvait plus inviter personne sur un autre, et un compte gratuit
-- partenaire du cheval d'un ami ne pouvait pas inviter en lecture seule sur le
-- sien. Le trigger enforce_horse_collaborator_quota, lui, comptait déjà bien
-- par cheval : il reste la garde contre les insertions concurrentes.
-- Test : packages/db/tests/rls/99b-quota-par-cheval.test.sql.

drop policy if exists "horse_collaborators_owner_insert" on public.horse_collaborators;
create policy "horse_collaborators_owner_insert" on public.horse_collaborators
  for insert with check (
    (public.owns_horse("horseId") or (public.horse_can("horseId", 'manage_sharing') and role <> 'MANAGER'))
    and (public.horse_owner_is_active_or_trialing("horseId") or role::text = 'VIEWER')
    and (
      select count(*) from public.horse_collaborators hc2
      where hc2."horseId" = horse_collaborators."horseId"
        and (hc2.status = 'ACCEPTED' or hc2."expiresAt" is null or hc2."expiresAt" > now())
    ) < public.horse_collaborator_limit("horseId")
  );
