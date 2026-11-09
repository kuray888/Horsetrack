-- Créneaux récurrents (Écurie Pro) et migration des jours de demi-pension.
-- Comptes : 1 propriétaire Pro, 2 demi-pension, 3 coach, 8 propriétaire
-- Premium, 9 sa demi-pension.

select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000008', 'premium@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000009', 'dp2@test.fr');

insert into public.horses (id, "ownerId", name, "updatedAt") values
  ('h1', 'rp_00000000-0000-0000-0000-000000000001', 'Tornade', now()),
  ('h8', 'rp_00000000-0000-0000-0000-000000000008', 'Prince', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", "collaboratorUserId", role, status, "updatedAt") values
  ('c2', 'h1', 'dp@test.fr',    '00000000-0000-0000-0000-000000000002', 'DEMI_PENSION', 'ACCEPTED', now()),
  ('c3', 'h1', 'coach@test.fr', '00000000-0000-0000-0000-000000000003', 'COACH',        'ACCEPTED', now()),
  ('c9', 'h8', 'dp2@test.fr',   '00000000-0000-0000-0000-000000000009', 'DEMI_PENSION', 'ACCEPTED', now());
insert into public.horse_details ("horseId", partnership, "updatedAt") values
  ('h1', '{"riderName": "Léa", "days": [2, 4], "monthlyFee": 150, "notes": ""}', now()),
  ('h8', '{"riderName": "Zoé", "days": [6], "monthlyFee": null, "notes": ""}', now());

-- Propriétaire Pro : migration de la demi-pension, puis ses créneaux.
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.sees('Migration : 2 créneaux créés', $$select 1 from (select public.migrate_partnership_slots('h1') as n) q where n = 2$$, 1);
select t.sees('Migration rejouée : aucun doublon', $$select 1 from (select public.migrate_partnership_slots('h1') as n) q where n = 0$$, 1);
select t.sees('Créneaux migrés : mardi et jeudi, au compte de la DP', $$select 1 from public.ride_slots where "horseId" = 'h1' and kind = 'DP' and "riderUserId" = '00000000-0000-0000-0000-000000000002' and weekday in (2, 4)$$, 2);
select t.allowed('Propriétaire Pro : ajoute un créneau', $$insert into public.ride_slots (id, "horseId", "riderUserId", weekday, "startTime", "endTime", "validFrom", kind, "updatedAt") values ('sl1', 'h1', '00000000-0000-0000-0000-000000000003', 6, '10:00', '11:00', now(), 'LESSON', now())$$);
select t.denied('Créneau : jour 8 refusé', $$insert into public.ride_slots (id, "horseId", weekday, "validFrom", "updatedAt") values ('sl_bad', 'h1', 8, now(), now())$$);
select t.denied('Créneau : cavalier hors équipe refusé', $$insert into public.ride_slots (id, "horseId", "riderUserId", weekday, "validFrom", "updatedAt") values ('sl_bad2', 'h1', '00000000-0000-0000-0000-000000000009', 1, now(), now())$$);
select t.logout();

-- Coach : gère le planning ; DP : lit seulement.
select t.login('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.allowed('Coach : modifie un créneau', $$update public.ride_slots set "startTime" = '18:30' where id = 'dp_h1_2'$$);
select t.denied('Coach : ne lance pas la migration', $$select public.migrate_partnership_slots('h1')$$);
select t.logout();
select t.login('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.sees('DP : voit les créneaux du cheval', 'select 1 from public.ride_slots', 3);
select t.denied('DP : ne modifie pas un créneau', $$update public.ride_slots set "startTime" = '07:00' where id = 'dp_h1_2'$$);
select t.denied('DP : ne crée pas de créneau', $$insert into public.ride_slots (id, "horseId", weekday, "validFrom", "updatedAt") values ('sl_dp', 'h1', 3, now(), now())$$);
select t.allowed('DP : coche une occurrence de son créneau (séance créée à la volée)', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "slotId", "riderUserId", completed, "updatedAt") values ('dp_h1_2_2026-11-10', 'h1', 'DRESSAGE', '2026-11-10', '18:30', '', 'dp_h1_2', '00000000-0000-0000-0000-000000000002', true, now())$$);
select t.logout();

-- Premium (pas Pro) : pas de créneau, ni de migration.
select t.login('00000000-0000-0000-0000-000000000008', 'premium@test.fr');
select t.denied('Premium : pas de créneau', $$insert into public.ride_slots (id, "horseId", weekday, "validFrom", "updatedAt") values ('sl8', 'h8', 6, now(), now())$$);
select t.denied('Premium : pas de migration', $$select public.migrate_partnership_slots('h8')$$);
select t.logout();

-- Fin de l'abonnement Pro : lecture seule.
update public.rider_profiles set "subscriptionStatus" = 'EXPIRED' where id = 'rp_00000000-0000-0000-0000-000000000001';
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.sees('Pro terminé : les créneaux restent lisibles', 'select 1 from public.ride_slots', 3);
select t.denied('Pro terminé : plus de modification', $$update public.ride_slots set notes = 'x' where id = 'sl1'$$);
select t.logout();

-- Migration par le backend (auth.uid() nul) : propriétaire Pro seulement dans
-- le script, mais la fonction elle-même accepte tout cheval.
select t.sees('Backend : migration d''un cheval Premium possible', $$select 1 from (select public.migrate_partnership_slots('h8') as n) q where n = 1$$, 1);
select t.sees('Backend : DP unique rattachée', $$select 1 from public.ride_slots where id = 'dp_h8_6' and "riderUserId" = '00000000-0000-0000-0000-000000000009' and "riderName" is null$$, 1);

-- Une personne sortie de l'équipe ne bloque pas la fin de son créneau.
update public.rider_profiles set "subscriptionStatus" = 'ACTIVE' where id = 'rp_00000000-0000-0000-0000-000000000001';
delete from public.horse_collaborators where id = 'c2';
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Créneau : un cavalier parti de l''équipe, le propriétaire peut encore le terminer', $$update public.ride_slots set "validUntil" = now() where id = 'dp_h1_2'$$);
select t.logout();
