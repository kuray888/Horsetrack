-- Quota d'invitations PAR CHEVAL (pas par compte) : la règle d'insertion comptait
-- les partenaires de tous les chevaux visibles ("horseId" non qualifié dans la
-- sous-requête), ce qui bloquait une invitation sur un 2e cheval.
select t.add_user('00000000-0000-0000-0000-000000000991', 'premium2@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000992', 'ami1@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000993', 'ami2@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000994', 'gratuit2@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000995', 'voisin@test.fr', 'GRAND_PRIX', 'ACTIVE');
insert into public.horses (id, "ownerId", name, "updatedAt") values
  ('qa', 'rp_00000000-0000-0000-0000-000000000991', 'A', now()),
  ('qb', 'rp_00000000-0000-0000-0000-000000000991', 'B', now()),
  ('qg', 'rp_00000000-0000-0000-0000-000000000994', 'G', now()),
  ('qv', 'rp_00000000-0000-0000-0000-000000000995', 'V', now());

select t.login('00000000-0000-0000-0000-000000000991', 'premium2@test.fr');
select t.allowed('Premium : invite une personne sur le cheval A', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('q1', 'qa', 'ami1@test.fr', 'DEMI_PENSION', now() + interval '14 days', now())$$);
select t.allowed('Premium : invite aussi une personne sur le cheval B', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('q2', 'qb', 'ami2@test.fr', 'DEMI_PENSION', now() + interval '14 days', now())$$);
select t.denied('Premium : toujours une seule personne par cheval', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('q3', 'qa', 'ami2@test.fr', 'DEMI_PENSION', now() + interval '14 days', now())$$);
select t.logout();

-- Un compte gratuit, lui-même partenaire du cheval d'un autre, invite quand même sur le sien.
insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, status, "collaboratorUserId", "updatedAt")
  values ('qx', 'qv', 'gratuit2@test.fr', 'DEMI_PENSION', 'ACCEPTED', '00000000-0000-0000-0000-000000000994', now());
select t.login('00000000-0000-0000-0000-000000000994', 'gratuit2@test.fr');
select t.allowed('Gratuit partenaire ailleurs : invite une personne en lecture seule sur son cheval', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('q4', 'qg', 'ami1@test.fr', 'VIEWER', now() + interval '14 days', now())$$);
select t.logout();
