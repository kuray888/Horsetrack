-- Fin d'abonnement : un ancien Premium garde tout ce qu'il a créé. Rien
-- n'est supprimé ni rendu illisible ; seules les créations au-delà du
-- palier gratuit sont refusées.
select t.add_user('00000000-0000-0000-0000-000000000251', 'ex@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000252', 'dp@test.fr');

select t.login('00000000-0000-0000-0000-000000000251', 'ex@test.fr');
select t.allowed('Premium : 1er cheval', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('x1', 'rp_00000000-0000-0000-0000-000000000251', 'Un', now())$$);
select t.allowed('Premium : 2e cheval', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('x2', 'rp_00000000-0000-0000-0000-000000000251', 'Deux', now())$$);
select t.allowed('Premium : séance sur le 2e', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('xs', 'x2', 'BALADE', now(), '10:00', '', now())$$);
select t.allowed('Premium : document', $$insert into public.documents (id, "riderId", name, category, date, "updatedAt") values ('xd', 'rp_00000000-0000-0000-0000-000000000251', 'Ordonnance', 'ORDONNANCE', now(), now())$$);
select t.allowed('Premium : partage le 1er', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('xc', 'x1', 'dp@test.fr', 'DEMI_PENSION', now() + interval '14 days', now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000252', 'dp@test.fr');
select t.allowed('DP : accepte', $$update public.horse_collaborators set status = 'ACCEPTED', "collaboratorUserId" = '00000000-0000-0000-0000-000000000252', "updatedAt" = now() where id = 'xc'$$);
select t.logout();

-- L'abonnement prend fin.
update public.rider_profiles set "subscriptionStatus" = 'EXPIRED' where id = 'rp_00000000-0000-0000-0000-000000000251';

select t.login('00000000-0000-0000-0000-000000000251', 'ex@test.fr');
select t.sees('Expiré : voit ses 2 chevaux', 'select 1 from public.horses', 2);
select t.sees('Expiré : voit la séance du 2e', 'select 1 from public.training_sessions', 1);
select t.sees('Expiré : voit son document', 'select 1 from public.documents', 1);
select t.denied('Expiré : pas de 3e cheval', $$insert into public.horses (id, "ownerId", name, "updatedAt") values ('x3', 'rp_00000000-0000-0000-0000-000000000251', 'Trois', now())$$);
select t.allowed('Expiré : modifie le nom du 1er cheval', $$update public.horses set name = 'Un bis' where id = 'x1'$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000252', 'dp@test.fr');
select t.sees('DP : voit toujours le cheval partagé', 'select 1 from public.horses', 1);
select t.logout();
