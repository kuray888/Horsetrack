-- Participation aux frais : propriétaire Pro et gérant écrivent, la DP lit
-- ses lignes, le coach rien.
select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000005', 'gerant@test.fr');
insert into public.horses (id, "ownerId", name, "updatedAt") values ('h1', 'rp_00000000-0000-0000-0000-000000000001', 'Tornade', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", "collaboratorUserId", role, status, "updatedAt") values
  ('c2', 'h1', 'dp@test.fr',     '00000000-0000-0000-0000-000000000002', 'DEMI_PENSION', 'ACCEPTED', now()),
  ('c3', 'h1', 'coach@test.fr',  '00000000-0000-0000-0000-000000000003', 'COACH',        'ACCEPTED', now()),
  ('c5', 'h1', 'gerant@test.fr', '00000000-0000-0000-0000-000000000005', 'MANAGER',      'ACCEPTED', now());

select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire Pro : ligne de la DP pour novembre', $$insert into public.participation_fees (id, "horseId", "payerUserId", month, amount, "updatedAt") values ('f1', 'h1', '00000000-0000-0000-0000-000000000002', '2026-11', 150, now())$$);
select t.allowed('Propriétaire Pro : ligne pour quelqu''un sans compte', $$insert into public.participation_fees (id, "horseId", "payerName", month, amount, "updatedAt") values ('f2', 'h1', 'Inès', '2026-11', 80, now())$$);
select t.denied('Mois invalide refusé', $$insert into public.participation_fees (id, "horseId", "payerName", month, amount, "updatedAt") values ('f_bad', 'h1', 'Inès', '2026-13', 80, now())$$);
select t.denied('Montant négatif refusé', $$insert into public.participation_fees (id, "horseId", "payerName", month, amount, "updatedAt") values ('f_bad2', 'h1', 'Inès', '2026-11', -5, now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000005', 'gerant@test.fr');
select t.allowed('Gérant : marque payé', $$update public.participation_fees set "paidAt" = now() where id = 'f1'$$);
select t.sees('Gérant : voit toutes les lignes', 'select 1 from public.participation_fees', 2);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.sees('DP : voit sa seule ligne', 'select 1 from public.participation_fees', 1);
select t.denied('DP : ne se marque pas payée', $$update public.participation_fees set "paidAt" = null where id = 'f1'$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.sees('Coach : rien', 'select 1 from public.participation_fees', 0);
select t.logout();

update public.rider_profiles set "subscriptionStatus" = 'EXPIRED' where id = 'rp_00000000-0000-0000-0000-000000000001';
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.sees('Pro terminé : lecture conservée', 'select 1 from public.participation_fees', 2);
select t.denied('Pro terminé : plus d''écriture', $$update public.participation_fees set notes = 'x' where id = 'f2'$$);
select t.logout();
