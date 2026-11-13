-- Invitation gratuite : une personne par cheval, en lecture seule (VIEWER).
select t.add_user('00000000-0000-0000-0000-000000000961', 'gratuit@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000962', 'invite@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000963', 'premium@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000964', 'autre@test.fr');
insert into public.horses (id, "ownerId", name, "updatedAt") values
  ('hg', 'rp_00000000-0000-0000-0000-000000000961', 'Gratuit', now()),
  ('hp', 'rp_00000000-0000-0000-0000-000000000963', 'Premium', now());
insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('sg', 'hg', 'BALADE', now(), '10:00', '', now());
insert into public.expenses (id, "horseId", category, amount, date, notes, "updatedAt") values ('eg', 'hg', 'PENSION', 400, now(), '', now());

select t.login('00000000-0000-0000-0000-000000000961', 'gratuit@test.fr');
select t.denied('Gratuit : pas d''invitation avec droits (demi-pension)', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('c0', 'hg', 'invite@test.fr', 'DEMI_PENSION', now() + interval '14 days', now())$$);
select t.allowed('Gratuit : invite une personne en lecture seule', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('c1', 'hg', 'invite@test.fr', 'VIEWER', now() + interval '14 days', now())$$);
select t.denied('Gratuit : pas de 2e personne', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('c2', 'hg', 'autre@test.fr', 'VIEWER', now() + interval '14 days', now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000962', 'invite@test.fr');
select t.allowed('Invité : accepte', $$update public.horse_collaborators set status = 'ACCEPTED', "collaboratorUserId" = '00000000-0000-0000-0000-000000000962', "updatedAt" = now() where id = 'c1'$$);
select t.sees('Invité : voit le cheval', 'select 1 from public.horses', 1);
select t.sees('Invité : voit la séance', 'select 1 from public.training_sessions', 1);
select t.sees('Invité : ne voit pas le budget', 'select 1 from public.expenses', 0);
select t.denied('Invité : n''ajoute pas de séance', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('sv', 'hg', 'BALADE', now(), '11:00', '', now())$$);
select t.denied('Invité : ne modifie pas la séance', $$update public.training_sessions set notes = 'x' where id = 'sg'$$);
select t.denied('Invité : ne modifie pas le cheval', $$update public.horses set name = 'X' where id = 'hg'$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000961', 'gratuit@test.fr');
select t.denied('Gratuit : ne transforme pas la lecture seule en demi-pension', $$update public.horse_collaborators set role = 'DEMI_PENSION', "updatedAt" = now() where id = 'c1'$$);
select t.logout();

-- Passé Premium : il peut donner plus de droits à la même personne.
update public.rider_profiles set "subscriptionTier" = 'GRAND_PRIX', "subscriptionStatus" = 'ACTIVE' where id = 'rp_00000000-0000-0000-0000-000000000961';
select t.login('00000000-0000-0000-0000-000000000961', 'gratuit@test.fr');
select t.allowed('Devenu Premium : passe l''invité en demi-pension', $$update public.horse_collaborators set role = 'DEMI_PENSION', "updatedAt" = now() where id = 'c1'$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000963', 'premium@test.fr');
select t.allowed('Premium : invite une demi-pension, comme avant', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('c3', 'hp', 'autre@test.fr', 'DEMI_PENSION', now() + interval '14 days', now())$$);
select t.logout();
