-- Droits par rôle (Écurie Pro v2) : une personne par rôle sur le même cheval.
-- Comptes : 1 propriétaire (Écurie Pro), 2 demi-pension, 3 coach, 4 groom,
-- 5 gérant, 6 vétérinaire, 7 inconnu.

select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000004', 'groom@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000005', 'gerant@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000006', 'veto@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000007', 'inconnu@test.fr');

-- Données posées par le backend (auth.uid() nul) : lignes sans auteur.
insert into public.horses (id, "ownerId", name, "updatedAt") values ('h1', 'rp_00000000-0000-0000-0000-000000000001', 'Tornade', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", "collaboratorUserId", role, status, "updatedAt") values
  ('c2', 'h1', 'dp@test.fr',     '00000000-0000-0000-0000-000000000002', 'DEMI_PENSION', 'ACCEPTED', now()),
  ('c3', 'h1', 'coach@test.fr',  '00000000-0000-0000-0000-000000000003', 'COACH',        'ACCEPTED', now()),
  ('c4', 'h1', 'groom@test.fr',  '00000000-0000-0000-0000-000000000004', 'GROOM',        'ACCEPTED', now()),
  ('c5', 'h1', 'gerant@test.fr', '00000000-0000-0000-0000-000000000005', 'MANAGER',      'ACCEPTED', now());
-- Le véto est accepté plus bas, après les tests d'invitation (limite de 5).
insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values
  ('a_veto', 'h1', 'VETO', 'Vaccin', now(), '10:00', '', '', 'none', now()),
  ('a_cso',  'h1', 'CONCOURS', 'CSO club', now(), '08:00', '', '', 'none', now());
insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values
  ('s_owner', 'h1', 'DRESSAGE', now(), '18:00', '', now());
insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values
  ('e1', 'h1', 120, 'VETO', now(), '', now());
insert into public.journal_entries (id, "horseId", "activityType", mood, notes, date, time, "updatedAt") values
  ('j_owner', 'h1', 'BALADE', 'GOOD', '', now(), '10:00', now());
insert into public.horse_details ("horseId", "updatedAt") values ('h1', now());

-- Demi-pension ---------------------------------------------------------------
select t.login('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.sees('DP : voit les rendez-vous', 'select 1 from public.appointments', 2);
select t.sees('DP : ne voit pas les dépenses', 'select 1 from public.expenses', 0);
select t.denied('DP : ne supprime pas un soin', $$delete from public.appointments where id = 'a_veto'$$);
select t.denied('DP : ne modifie pas un soin', $$update public.appointments set notes = 'x' where id = 'a_veto'$$);
select t.denied('DP : ne crée pas de soin', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('a_dp', 'h1', 'VETO', 'x', now(), '10:00', '', '', 'none', now())$$);
select t.denied('DP : ne crée pas de dépense', $$insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values ('e_dp', 'h1', 10, 'AUTRE', now(), '', now())$$);
select t.denied('DP : ne modifie pas la fiche', $$update public.horse_details set partnership = '{"riderName":"x"}' where "horseId" = 'h1'$$);
select t.allowed('DP : crée sa séance (auteur imposé par la base)', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "createdByUserId", "updatedAt") values ('s_dp', 'h1', 'CSO', now(), '18:00', '', '00000000-0000-0000-0000-000000000001', now())$$);
select t.allowed('DP : modifie sa séance', $$update public.training_sessions set notes = 'ok' where id = 's_dp'$$);
select t.allowed('DP : sa séance par upsert (synchro)', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, completed, "updatedAt") values ('s_dp', 'h1', 'CSO', now(), '18:00', 'fait', true, now()) on conflict (id) do update set notes = excluded.notes, completed = excluded.completed$$);
select t.denied('DP : ne modifie pas la séance du propriétaire', $$update public.training_sessions set notes = 'x' where id = 's_owner'$$);
select t.denied('DP : ni par upsert', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('s_owner', 'h1', 'CSO', now(), '18:00', 'x', now()) on conflict (id) do update set notes = excluded.notes$$);
select t.denied('DP : ne supprime pas la séance du propriétaire', $$delete from public.training_sessions where id = 's_owner'$$);
select t.allowed('DP : parcours GPS de sa séance', $$insert into public.training_session_rides (id, "sessionId", "horseId", "startedAt", "endedAt", "durationSeconds", "updatedAt") values ('s_dp', 's_dp', 'h1', now(), now(), 60, now())$$);
select t.denied('DP : pas de parcours sur la séance du propriétaire', $$insert into public.training_session_rides (id, "sessionId", "horseId", "startedAt", "endedAt", "durationSeconds", "updatedAt") values ('s_owner', 's_owner', 'h1', now(), now(), 60, now())$$);
select t.allowed('DP : écrit dans le journal', $$insert into public.journal_entries (id, "horseId", "activityType", mood, notes, date, time, "updatedAt") values ('j_dp', 'h1', 'CSO', 'GREAT', '', now(), '18:00', now())$$);
select t.allowed('DP : modifie sa note', $$update public.journal_entries set notes = 'super' where id = 'j_dp'$$);
select t.denied('DP : ne supprime pas la note du propriétaire', $$delete from public.journal_entries where id = 'j_owner'$$);
select t.denied('DP : pas de pesée', $$insert into public.horse_weight_measurements (id, "horseId", "weightKg", date, "updatedAt") values ('w_dp', 'h1', 500, now(), now())$$);
select t.denied('DP : ne voit pas les invitations des autres', $$update public.horse_collaborators set role = 'COACH' where id = 'c4'$$);
select t.sees('DP : ne voit que sa ligne de partage', 'select 1 from public.horse_collaborators', 1);
select t.logout();
select t.sees('auteur posé par la base, pas par l''app', $$select 1 from public.training_sessions where id = 's_dp' and "createdByUserId" = '00000000-0000-0000-0000-000000000002'$$, 1);

-- Coach ----------------------------------------------------------------------
select t.login('00000000-0000-0000-0000-000000000003', 'coach@test.fr');
select t.allowed('Coach : modifie toute séance', $$update public.training_sessions set notes = 'coach' where id = 's_owner'$$);
select t.allowed('Coach : modifie un concours', $$update public.appointments set notes = 'dossard 12' where id = 'a_cso'$$);
select t.denied('Coach : ne modifie pas un soin', $$update public.appointments set notes = 'x' where id = 'a_veto'$$);
select t.denied('Coach : ne crée pas de soin', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('a_coach', 'h1', 'OSTEO', 'x', now(), '10:00', '', '', 'none', now())$$);
select t.sees('Coach : ne voit pas les dépenses', 'select 1 from public.expenses', 0);
select t.logout();

-- Groom ----------------------------------------------------------------------
select t.login('00000000-0000-0000-0000-000000000004', 'groom@test.fr');
select t.allowed('Groom : ajoute un vermifuge', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('a_groom', 'h1', 'VERMIFUGE', 'Vermifuge', now(), '09:00', '', '', 'none', now())$$);
select t.allowed('Groom : modifie son soin', $$update public.appointments set notes = 'fait' where id = 'a_groom'$$);
select t.denied('Groom : ne supprime pas le soin du propriétaire', $$delete from public.appointments where id = 'a_veto'$$);
select t.denied('Groom : ne crée pas de concours', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('a_groom_cso', 'h1', 'CONCOURS', 'x', now(), '09:00', '', '', 'none', now())$$);
select t.allowed('Groom : pèse le cheval', $$insert into public.horse_weight_measurements (id, "horseId", "weightKg", date, "updatedAt") values ('w_groom', 'h1', 510, now(), now())$$);
select t.denied('Groom : ne crée pas de séance', $$insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('s_groom', 'h1', 'LONGE', now(), '18:00', '', now())$$);
select t.logout();

-- Gérant ---------------------------------------------------------------------
select t.login('00000000-0000-0000-0000-000000000005', 'gerant@test.fr');
select t.sees('Gérant : voit les dépenses', 'select 1 from public.expenses', 1);
select t.allowed('Gérant : ajoute une dépense', $$insert into public.expenses (id, "horseId", amount, category, date, notes, "updatedAt") values ('e_gerant', 'h1', 300, 'PENSION', now(), '', now())$$);
select t.allowed('Gérant : modifie un soin', $$update public.appointments set notes = 'rappel' where id = 'a_veto'$$);
select t.allowed('Gérant : modifie la fiche', $$update public.horse_details set feeding = '{"notes":"foin"}' where "horseId" = 'h1'$$);
select t.allowed('Gérant : supprime la note d''un autre', $$delete from public.journal_entries where id = 'j_dp'$$);
select t.sees('Gérant : voit l''équipe', 'select 1 from public.horse_collaborators', 4);
select t.allowed('Gérant : invite un véto', $$insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, "expiresAt", "updatedAt") values ('c6', 'h1', 'veto@test.fr', 'VET', now() + interval '14 days', now())$$);
select t.allowed('Gérant : change un rôle', $$update public.horse_collaborators set role = 'RIDER' where id = 'c4'$$);
select t.denied('Gérant : n''accepte pas à la place de l''invité', $$update public.horse_collaborators set status = 'ACCEPTED', "collaboratorUserId" = '00000000-0000-0000-0000-000000000005' where id = 'c6'$$);
select t.denied('Gérant : ne nomme pas de gérant', $$update public.horse_collaborators set role = 'MANAGER' where id = 'c3'$$);
select t.denied('Gérant : ne retire pas un autre gérant (lui-même excepté)', $$delete from public.horse_collaborators where role = 'MANAGER' and "collaboratorUserId" <> '00000000-0000-0000-0000-000000000005'$$);
select t.denied('Gérant : ne supprime pas le cheval', $$delete from public.horses where id = 'h1'$$);
select t.logout();

-- Véto (après acceptation) ----------------------------------------------------
select t.login('00000000-0000-0000-0000-000000000006', 'veto@test.fr');
select t.allowed('Véto : accepte l''invitation', $$update public.horse_collaborators set status = 'ACCEPTED', "collaboratorUserId" = '00000000-0000-0000-0000-000000000006', "updatedAt" = now() where id = 'c6'$$);
select t.allowed('Véto : ajoute un soin', $$insert into public.appointments (id, "horseId", type, title, date, time, location, notes, reminder, "updatedAt") values ('a_vet', 'h1', 'VETO', 'Visite', now(), '14:00', '', '', 'none', now())$$);
select t.allowed('Véto : pèse le cheval', $$insert into public.horse_weight_measurements (id, "horseId", "weightKg", date, "updatedAt") values ('w_vet', 'h1', 505, now(), now())$$);
select t.denied('Véto : ne modifie pas la pesée du groom', $$update public.horse_weight_measurements set "weightKg" = 1 where id = 'w_groom'$$);
select t.logout();

-- Propriétaire et inconnu ---------------------------------------------------
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire : supprime le soin du groom', $$delete from public.appointments where id = 'a_groom'$$);
select t.allowed('Propriétaire : modifie la séance de la DP', $$update public.training_sessions set notes = 'vu' where id = 's_dp'$$);
select t.allowed('Propriétaire : nomme un gérant', $$update public.horse_collaborators set role = 'MANAGER' where id = 'c3'$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000007', 'inconnu@test.fr');
select t.sees('Inconnu : ne voit aucune séance', 'select 1 from public.training_sessions', 0);
select t.denied('Inconnu : ne crée rien', $$insert into public.journal_entries (id, "horseId", "activityType", mood, notes, date, time, "updatedAt") values ('j_x', 'h1', 'CSO', 'GREAT', '', now(), '18:00', now())$$);
select t.logout();
