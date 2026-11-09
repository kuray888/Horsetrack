-- Tâches d'écurie (Écurie Pro). Comptes : 1 propriétaire Pro, 2 demi-pension,
-- 3 groom, 4 ancienne DP (accès d'avant), 5 coach.
select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000003', 'groom@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000004', 'olddp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000005', 'coach@test.fr');
insert into public.horses (id, "ownerId", name, "updatedAt") values ('h1', 'rp_00000000-0000-0000-0000-000000000001', 'Tornade', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", "collaboratorUserId", role, status, "fullAccess", "updatedAt") values
  ('c2', 'h1', 'dp@test.fr',    '00000000-0000-0000-0000-000000000002', 'DEMI_PENSION', 'ACCEPTED', false, now()),
  ('c3', 'h1', 'groom@test.fr', '00000000-0000-0000-0000-000000000003', 'GROOM',        'ACCEPTED', false, now()),
  ('c4', 'h1', 'olddp@test.fr', '00000000-0000-0000-0000-000000000004', 'DEMI_PENSION', 'ACCEPTED', true,  now()),
  ('c5', 'h1', 'coach@test.fr', '00000000-0000-0000-0000-000000000005', 'COACH',        'ACCEPTED', false, now());

select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire Pro : tâche récurrente pour la DP', $$insert into public.stable_tasks (id, "horseId", title, "assigneeUserId", weekdays, "validFrom", "updatedAt") values ('t1', 'h1', 'Sortie au pré', '00000000-0000-0000-0000-000000000002', '{1,2,3,4,5}', now(), now())$$);
select t.allowed('Propriétaire Pro : tâche ponctuelle pour quelqu''un sans compte', $$insert into public.stable_tasks (id, "horseId", title, "assigneeName", "dueDate", "validFrom", "updatedAt") values ('t2', 'h1', 'Couverture', 'Inès', now(), now(), now())$$);
select t.denied('Titre vide refusé', $$insert into public.stable_tasks (id, "horseId", title, weekdays, "validFrom", "updatedAt") values ('t_bad', 'h1', '  ', '{}', now(), now())$$);
select t.denied('Jour 8 refusé', $$insert into public.stable_tasks (id, "horseId", title, weekdays, "validFrom", "updatedAt") values ('t_bad2', 'h1', 'x', '{8}', now(), now())$$);
select t.denied('Chargé de tâche hors équipe refusé', $$insert into public.stable_tasks (id, "horseId", title, "assigneeUserId", weekdays, "validFrom", "updatedAt") values ('t_bad3', 'h1', 'x', '00000000-0000-0000-0000-000000000099', '{}', now(), now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000003', 'groom@test.fr');
select t.allowed('Groom : crée une tâche', $$insert into public.stable_tasks (id, "horseId", title, "assigneeUserId", weekdays, "validFrom", "updatedAt") values ('t3', 'h1', 'Repas du soir', '00000000-0000-0000-0000-000000000003', '{1,2,3,4,5,6,7}', now(), now())$$);
select t.allowed('Groom : coche une tâche', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t3_2026-11-10', 't3', 'h1', '2026-11-10')$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000002', 'dp@test.fr');
select t.sees('DP : voit les tâches du cheval', 'select 1 from public.stable_tasks', 3);
select t.denied('DP : ne crée pas de tâche', $$insert into public.stable_tasks (id, "horseId", title, weekdays, "validFrom", "updatedAt") values ('t_dp', 'h1', 'x', '{}', now(), now())$$);
select t.allowed('DP : coche la tâche qui lui est confiée', $$insert into public.stable_task_completions (id, "taskId", "horseId", date, "doneByUserId") values ('t1_2026-11-10', 't1', 'h1', '2026-11-10', '00000000-0000-0000-0000-000000000099')$$);
select t.denied('DP : ne coche pas celle d''un autre', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t3_2026-11-11', 't3', 'h1', '2026-11-11')$$);
select t.denied('DP : ne modifie pas une tâche', $$update public.stable_tasks set title = 'x' where id = 't1'$$);
select t.allowed('DP : décoche la sienne', $$delete from public.stable_task_completions where id = 't1_2026-11-10'$$);
select t.allowed('DP : recoche', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t1_2026-11-10', 't1', 'h1', '2026-11-10')$$);
select t.logout();
select t.sees('Cochée : par la DP (pas par l''identité envoyée), avec l''heure', $$select 1 from public.stable_task_completions where id = 't1_2026-11-10' and "doneByUserId" = '00000000-0000-0000-0000-000000000002' and "doneAt" is not null$$, 1);

select t.login('00000000-0000-0000-0000-000000000004', 'olddp@test.fr');
select t.sees('Ancienne DP : lit les tâches', 'select 1 from public.stable_tasks', 3);
select t.denied('Ancienne DP : n''en crée pas (nouveauté)', $$insert into public.stable_tasks (id, "horseId", title, weekdays, "validFrom", "updatedAt") values ('t_old', 'h1', 'x', '{}', now(), now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000005', 'coach@test.fr');
select t.denied('Coach : ne crée pas de tâche', $$insert into public.stable_tasks (id, "horseId", title, weekdays, "validFrom", "updatedAt") values ('t_c', 'h1', 'x', '{}', now(), now())$$);
select t.denied('Coach : ne coche pas', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t1_2026-11-12', 't1', 'h1', '2026-11-12')$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.allowed('Propriétaire : coche pour tout le monde', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t3_2026-11-12', 't3', 'h1', '2026-11-12')$$);
select t.denied('Complétion sur un autre cheval refusée', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t3_x', 't3', 'h_autre', '2026-11-12')$$);
select t.logout();

update public.rider_profiles set "subscriptionStatus" = 'EXPIRED' where id = 'rp_00000000-0000-0000-0000-000000000001';
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.sees('Pro terminé : les tâches restent lisibles', 'select 1 from public.stable_tasks', 3);
select t.denied('Pro terminé : plus de nouvelle tâche', $$insert into public.stable_tasks (id, "horseId", title, weekdays, "validFrom", "updatedAt") values ('t_end', 'h1', 'x', '{}', now(), now())$$);
select t.denied('Pro terminé : plus de coche', $$insert into public.stable_task_completions (id, "taskId", "horseId", date) values ('t1_2026-11-13', 't1', 'h1', '2026-11-13')$$);
select t.logout();
