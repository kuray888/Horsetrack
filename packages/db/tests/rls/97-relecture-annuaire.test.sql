-- 1.3.0 : trace détaillée des séances et adresse des contacts. Rejoue la migration
-- sur l'état d'AVANT (colonnes absentes, données existantes) puis vérifie les droits.
select t.add_user('00000000-0000-0000-0000-000000000971', 'a@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000972', 'b@test.fr');
insert into public.horses (id, "ownerId", name, "updatedAt") values ('h97', 'rp_00000000-0000-0000-0000-000000000971', 'Cheval', now());
insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values ('s97', 'h97', 'BALADE', now(), '10:00', '', now());
insert into public.training_session_rides (id, "sessionId", "horseId", "startedAt", "endedAt", "durationSeconds", route, "updatedAt")
  values ('s97', 's97', 'h97', now(), now(), 600, '_p~iF~ps|U', now());
insert into public.rider_contacts (id, "userId", name, "updatedAt") values ('c97', '00000000-0000-0000-0000-000000000971', 'Véto', now());

-- État d'avant : colonnes absentes.
alter table public.training_session_rides drop column "trace";
alter table public.rider_contacts drop column "address";
\i :PRISMA_DIR/relecture-et-annuaire-2026-11-13.sql
\i :PRISMA_DIR/relecture-et-annuaire-2026-11-13.sql

insert into t.results (ok, label, detail)
select r.route = '_p~iF~ps|U' and r."trace" is null, 'Séance existante : intacte, trace vide', null from public.training_session_rides r where r.id = 's97';
insert into t.results (ok, label, detail)
select c.address = '' and c.name = 'Véto', 'Contact existant : intact, adresse vide', null from public.rider_contacts c where c.id = 'c97';

select t.login('00000000-0000-0000-0000-000000000971', 'a@test.fr');
select t.allowed('Propriétaire : enregistre la trace de sa séance', $$update public.training_session_rides set "trace" = '{"v":1}' where id = 's97'$$);
select t.allowed('Propriétaire : ajoute l''adresse d''un contact', $$update public.rider_contacts set address = '1 rue du Haras' where id = 'c97'$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000972', 'b@test.fr');
select t.sees('Autre compte : ne voit pas le contact ni son adresse', 'select 1 from public.rider_contacts', 0);
select t.sees('Autre compte : ne voit pas la trace', 'select 1 from public.training_session_rides', 0);
select t.denied('Autre compte : ne modifie pas la trace', $$update public.training_session_rides set "trace" = 'x' where id = 's97'$$);
select t.logout();
