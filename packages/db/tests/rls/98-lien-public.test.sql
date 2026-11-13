-- Lien public d'une séance : table réservée à l'API. Rejoue la migration sur l'état
-- d'avant (table absente), puis vérifie qu'aucun compte ne la lit ni ne l'écrit.
select t.add_user('00000000-0000-0000-0000-000000000981', 'a@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000982', 'b@test.fr');
drop table public.public_rides;
\i :PRISMA_DIR/lien-public-seance-2026-11-13.sql
\i :PRISMA_DIR/lien-public-seance-2026-11-13.sql
grant all on public.public_rides to authenticated, anon, service_role;
insert into public.public_rides (id, "userId", "startedAt", "durationSeconds")
  values ('tok', '00000000-0000-0000-0000-000000000981', now(), 600);

select t.login('00000000-0000-0000-0000-000000000981', 'a@test.fr');
select t.sees('Propriétaire : la table n''est pas lisible par le client', 'select 1 from public.public_rides', 0);
select t.denied('Propriétaire : ne publie pas lui-même (l''API seule écrit)', $$insert into public.public_rides (id, "userId", "startedAt", "durationSeconds") values ('t2', '00000000-0000-0000-0000-000000000981', now(), 1)$$);
select t.logout();
select t.login('00000000-0000-0000-0000-000000000982', 'b@test.fr');
select t.sees('Autre compte : ne voit rien', 'select 1 from public.public_rides', 0);
select t.denied('Autre compte : ne supprime pas le lien', $$delete from public.public_rides where id = 'tok'$$);
select t.logout();

-- Suppression du compte : le lien disparaît avec lui.
delete from public.users where id = '00000000-0000-0000-0000-000000000981';
insert into t.results (ok, label, detail)
select count(*) = 0, 'Compte supprimé : son lien public aussi', null from public.public_rides;
