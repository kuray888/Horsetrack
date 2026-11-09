-- Les partages d'avant les droits par rôle gardent exactement leurs droits ;
-- les nouveaux suivent la matrice. Comptes : 1 propriétaire Écurie Pro,
-- 2 ancienne DP, 3 nouvelle DP, 4 ancien groom.

select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000002', 'olddp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000003', 'newdp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000004', 'oldgroom@test.fr');
insert into public.horses (id, "ownerId", name, "updatedAt") values ('h1', 'rp_00000000-0000-0000-0000-000000000001', 'Tornade', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", "collaboratorUserId", role, status, "fullAccess", "updatedAt") values
  ('c2', 'h1', 'olddp@test.fr',    '00000000-0000-0000-0000-000000000002', 'DEMI_PENSION', 'ACCEPTED', true,  now()),
  ('c3', 'h1', 'newdp@test.fr',    '00000000-0000-0000-0000-000000000003', 'DEMI_PENSION', 'ACCEPTED', false, now()),
  ('c4', 'h1', 'oldgroom@test.fr', '00000000-0000-0000-0000-000000000004', 'GROOM',        'ACCEPTED', true,  now());
insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values
  ('a1', 'h1', 'VETO', 'Vaccin', now(), '10:00', '', '', 'none', now());
insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values ('e1', 'h1', 120, 'VETO', now(), '', now());
insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('s1', 'h1', 'DRESSAGE', now(), '18:00', '', now());
insert into public.journal_entries (id, "horseId", "activityType", mood, notes, date, time, "updatedAt") values ('j1', 'h1', 'BALADE', 'GOOD', '', now(), '10:00', now());
insert into public.horse_details ("horseId", "updatedAt") values ('h1', now());
insert into public.participation_fees (id, "horseId", "payerName", month, amount, "updatedAt") values ('f1', 'h1', 'Inès', '2026-11', 80, now());

-- Ancienne demi-pension : comme avant.
select t.login('00000000-0000-0000-0000-000000000002', 'olddp@test.fr');
select t.sees('Ancienne DP : voit toujours les dépenses', 'select 1 from public.expenses', 1);
select t.allowed('Ancienne DP : ajoute une dépense', $$insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values ('e2', 'h1', 10, 'AUTRE', now(), '', now())$$);
select t.allowed('Ancienne DP : modifie un soin du propriétaire', $$update public.appointments set notes = 'ok' where id = 'a1'$$);
select t.allowed('Ancienne DP : modifie la séance du propriétaire', $$update public.training_sessions set notes = 'ok' where id = 's1'$$);
select t.allowed('Ancienne DP : modifie la fiche', $$update public.horse_details set feeding = '{"notes":"foin"}' where "horseId" = 'h1'$$);
select t.allowed('Ancienne DP : supprime une note du journal', $$delete from public.journal_entries where id = 'j1'$$);
select t.denied('Ancienne DP : ne gère toujours pas l''équipe', $$update public.horse_collaborators set role = 'COACH' where id = 'c4'$$);
select t.sees('Ancienne DP : ne voit pas les frais des autres (nouveauté)', 'select 1 from public.participation_fees', 0);
select t.logout();

-- Ancien groom : ses soins, comme avant.
select t.login('00000000-0000-0000-0000-000000000004', 'oldgroom@test.fr');
select t.allowed('Ancien groom : supprime un soin', $$delete from public.appointments where id = 'a1'$$);
select t.allowed('Ancien groom : ajoute une dépense', $$insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values ('e3', 'h1', 5, 'AUTRE', now(), '', now())$$);
select t.logout();

-- Nouvelle demi-pension : la matrice.
select t.login('00000000-0000-0000-0000-000000000003', 'newdp@test.fr');
select t.sees('Nouvelle DP : ne voit pas les dépenses', 'select 1 from public.expenses', 0);
select t.denied('Nouvelle DP : ne modifie pas un soin', $$update public.appointments set notes = 'x' where id = 'a1'$$);
select t.denied('Nouvelle DP : ne modifie pas la séance du propriétaire', $$update public.training_sessions set notes = 'x' where id = 's1'$$);
select t.logout();

-- Une invitation ne peut pas se donner l'accès complet.
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire : invite une nouvelle personne', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "fullAccess", "expiresAt", "updatedAt") values ('c5', 'h1', 'new@test.fr', 'COACH', true, now() + interval '14 days', now())$$);
select t.logout();
select t.sees('Nouvelle invitation : jamais d''accès complet', $$select 1 from public.horse_collaborators where id = 'c5' and not "fullAccess"$$, 1);

-- Le propriétaire applique les droits du rôle : l'ancienne DP rejoint la matrice, sans retour.
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire : applique les droits du rôle', $$update public.horse_collaborators set "fullAccess" = false where id = 'c2'$$);
update public.horse_collaborators set "fullAccess" = true where id = 'c2';
select t.logout();
select t.sees('Propriétaire : l''app ne peut pas le redonner', $$select 1 from public.horse_collaborators where id = 'c2' and not "fullAccess"$$, 1);
select t.login('00000000-0000-0000-0000-000000000002', 'olddp@test.fr');
select t.sees('Ex-ancienne DP : plus de dépenses', 'select 1 from public.expenses', 0);
select t.logout();
