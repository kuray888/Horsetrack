-- Séance attribuée à un cavalier, « C'est fait » coché par celui qui a monté.
-- Comptes : 1 propriétaire (Écurie Pro), 2 demi-pension, 3 coach, 4 groom,
-- 7 inconnu.

select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000004', 'groom@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000007', 'inconnu@test.fr');
update public.users set name = 'Léa' where id = '00000000-0000-0000-0000-000000000002';

insert into public.horses (id, "ownerId", name, "updatedAt") values ('h1', 'rp_00000000-0000-0000-0000-000000000001', 'Tornade', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", "collaboratorUserId", role, status, "updatedAt") values
  ('c2', 'h1', 'dp@test.fr',    '00000000-0000-0000-0000-000000000002', 'DEMI_PENSION', 'ACCEPTED', now()),
  ('c3', 'h1', 'coach@test.fr', '00000000-0000-0000-0000-000000000003', 'COACH',        'ACCEPTED', now()),
  ('c4', 'h1', 'groom@test.fr', '00000000-0000-0000-0000-000000000004', 'GROOM',        'ACCEPTED', now());

-- Le propriétaire planifie et attribue.
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire : attribue une séance à la DP', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "riderUserId", "updatedAt") values ('s1', 'h1', 'DRESSAGE', now(), '18:00', 'Travail sur le plat', '00000000-0000-0000-0000-000000000002', now())$$);
select t.allowed('Propriétaire : séance pour quelqu''un sans compte', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "riderName", "updatedAt") values ('s2', 'h1', 'BALADE', now(), '10:00', '', 'Inès', now())$$);
select t.denied('Propriétaire : pas à quelqu''un hors de l''équipe', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "riderUserId", "updatedAt") values ('s3', 'h1', 'CSO', now(), '18:00', '', '00000000-0000-0000-0000-000000000007', now())$$);
select t.sees('Équipe : 4 personnes, avec un nom', $$select 1 from public.horse_team('h1') where name <> ''$$, 4);
select t.sees('Équipe : le prénom saisi l''emporte', $$select 1 from public.horse_team('h1') where name = 'Léa' and role = 'DEMI_PENSION'$$, 1);
select t.logout();

-- La DP coche sa séance ; sa copie ancienne ne réécrit rien d'autre.
select t.login('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.allowed('DP : coche la séance qu''on lui a attribuée', $$update public.training_sessions set completed = true, feeling = 'GOOD', "durationMinutes" = 50 where id = 's1'$$);
select t.allowed('DP : copie ancienne renvoyée par la synchro (upsert)', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, completed, feeling, "riderUserId", "updatedAt") values ('s1', 'h1', 'CSO', now() - interval '3 days', '07:00', 'vieux texte', true, 'GOOD', '00000000-0000-0000-0000-000000000002', now()) on conflict (id) do update set "activityType" = excluded."activityType", date = excluded.date, time = excluded.time, notes = excluded.notes, completed = excluded.completed, feeling = excluded.feeling$$);
select t.denied('DP : ne coche pas la séance de quelqu''un d''autre', $$update public.training_sessions set completed = true where id = 's2'$$);
select t.denied('DP : ne supprime pas une séance attribuée par le propriétaire', $$delete from public.training_sessions where id = 's1'$$);
select t.allowed('DP : parcours GPS de sa séance attribuée', $$insert into public.training_session_rides (id, "sessionId", "horseId", "startedAt", "endedAt", "durationSeconds", "updatedAt") values ('s1', 's1', 'h1', now(), now(), 3000, now())$$);
select t.denied('DP : ne s''attribue pas la séance d''un autre', $$update public.training_sessions set "riderUserId" = '00000000-0000-0000-0000-000000000002' where id = 's2'$$);
select t.denied('DP : ne crée pas de séance pour le groom', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "riderUserId", "updatedAt") values ('s4', 'h1', 'LONGE', now(), '18:00', '', '00000000-0000-0000-0000-000000000004', now())$$);
select t.allowed('DP : crée une séance pour elle-même', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "riderUserId", "updatedAt") values ('s5', 'h1', 'CSO', now(), '18:00', '', '00000000-0000-0000-0000-000000000002', now())$$);
select t.logout();

select t.sees('Fait : par la DP, avec ressenti et durée', $$select 1 from public.training_sessions where id = 's1' and completed and "doneByUserId" = '00000000-0000-0000-0000-000000000002' and "doneAt" is not null and feeling = 'GOOD' and "durationMinutes" = 50$$, 1);
select t.sees('Fait : le reste de la séance n''a pas bougé', $$select 1 from public.training_sessions where id = 's1' and "activityType" = 'DRESSAGE' and time = '18:00' and notes = 'Travail sur le plat'$$, 1);

-- Le coach réattribue ; « fait » ne se falsifie pas.
select t.login('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.allowed('Coach : attribue une séance au groom', $$update public.training_sessions set "riderUserId" = '00000000-0000-0000-0000-000000000004', "riderName" = null where id = 's2'$$);
select t.allowed('Coach : décoche', $$update public.training_sessions set completed = false where id = 's1'$$);
select t.logout();
select t.sees('Décoché : plus d''auteur ni de date', $$select 1 from public.training_sessions where id = 's1' and not completed and "doneByUserId" is null and "doneAt" is null$$, 1);

select t.login('00000000-0000-0000-0000-000000000004', 'groom@test.fr');
select t.allowed('Groom : coche la séance qu''on lui a attribuée', $$update public.training_sessions set completed = true, "doneByUserId" = '00000000-0000-0000-0000-000000000001' where id = 's2'$$);
select t.logout();
select t.sees('Fait : l''auteur réel, pas celui envoyé', $$select 1 from public.training_sessions where id = 's2' and "doneByUserId" = '00000000-0000-0000-0000-000000000004'$$, 1);

select t.login('00000000-0000-0000-0000-000000000007', 'inconnu@test.fr');
select t.sees('Inconnu : pas d''équipe visible', $$select 1 from public.horse_team('h1')$$, 0);
select t.logout();
