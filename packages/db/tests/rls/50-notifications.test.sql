-- Journal des notifications du planning : réservé à l'API.
select t.add_user('00000000-0000-0000-0000-000000000001', 'owner@test.fr', 'PRO', 'ACTIVE');
insert into public.planning_notifications (id, "senderUserId") values ('session:s1:done:u2', '00000000-0000-0000-0000-000000000001');
select t.login('00000000-0000-0000-0000-000000000001', 'owner@test.fr');
select t.sees('App : ne lit pas le journal', 'select 1 from public.planning_notifications', 0);
select t.denied('App : n''y écrit pas', $$insert into public.planning_notifications (id, "senderUserId") values ('x', '00000000-0000-0000-0000-000000000001')$$);
select t.logout();
