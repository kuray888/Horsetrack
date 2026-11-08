-- Comportements antérieurs à Écurie Pro v2, qui ne doivent pas bouger.

select t.add_user('00000000-0000-0000-0000-000000000011', 'gratuit@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000012', 'premium@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000013', 'ami@test.fr');

-- Compte gratuit : son cheval, ses séances, ses soins, ses dépenses.
select t.login('00000000-0000-0000-0000-000000000011', 'gratuit@test.fr');
select t.allowed('Gratuit : crée son cheval', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('hf', 'rp_00000000-0000-0000-0000-000000000011', 'Gamin', now())$$);
select t.denied('Gratuit : pas de 2e cheval', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('hf2', 'rp_00000000-0000-0000-0000-000000000011', 'Deux', now())$$);
select t.allowed('Gratuit : crée une séance', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('sf', 'hf', 'BALADE', now(), '10:00', '', now())$$);
select t.allowed('Gratuit : supprime sa séance', $$delete from public.training_sessions where id = 'sf'$$);
select t.allowed('Gratuit : crée un soin', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('af', 'hf', 'MARECHAL', 'Ferrure', now(), '10:00', '', '', 'none', now())$$);
select t.allowed('Gratuit : crée un concours', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('af2', 'hf', 'CONCOURS', 'CSO', now(), '10:00', '', '', 'none', now())$$);
select t.allowed('Gratuit : crée une dépense', $$insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values ('ef', 'hf', 50, 'MARECHAL', now(), '', now())$$);
select t.allowed('Gratuit : modifie la fiche', $$insert into public.horse_details ("horseId", "updatedAt") values ('hf', now())$$);
select t.denied('Gratuit : ne partage pas', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('cf', 'hf', 'ami@test.fr', 'RIDER', now() + interval '14 days', now())$$);
select t.logout();

-- Premium : une seule personne par cheval.
select t.login('00000000-0000-0000-0000-000000000012', 'premium@test.fr');
select t.allowed('Premium : crée son cheval', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('hp', 'rp_00000000-0000-0000-0000-000000000012', 'Prince', now())$$);
select t.allowed('Premium : 2e cheval (illimité)', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('hp2', 'rp_00000000-0000-0000-0000-000000000012', 'Second', now())$$);
select t.allowed('Premium : nomme un gérant', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('cp', 'hp', 'ami@test.fr', 'MANAGER', now() + interval '14 days', now())$$);
select t.denied('Premium : pas de 2e personne', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('cp2', 'hp', 'autre@test.fr', 'GROOM', now() + interval '14 days', now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000013', 'ami@test.fr');
select t.allowed('Invité : accepte', $$update public.horse_collaborators set status = 'ACCEPTED', "collaboratorUserId" = '00000000-0000-0000-0000-000000000013', "updatedAt" = now() where id = 'cp'$$);
select t.denied('Invité : ne change pas de cheval', $$update public.horse_collaborators set "horseId" = 'hp2' where id = 'cp'$$);
select t.allowed('Invité : quitte le partage', $$delete from public.horse_collaborators where id = 'cp'$$);
select t.sees('Ancien invité : ne voit plus le cheval', 'select 1 from public.horses', 0);
select t.logout();
