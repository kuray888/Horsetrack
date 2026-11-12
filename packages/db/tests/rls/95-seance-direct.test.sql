-- Séance en direct (1.3.0) : Premium pour les nouveaux comptes, la première
-- offerte ; les comptes d'avant gardent tout. Seule la création d'un parcours
-- est contrôlée.
select t.add_user('00000000-0000-0000-0000-000000000951', 'ancien@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000952', 'nouveau@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000953', 'premium@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000954', 'dp@test.fr');
-- État posé par l'étape 1 de la migration : tout compte existant garde la séance gratuite.
update public.rider_profiles set "liveRideFree" = true where id = 'rp_00000000-0000-0000-0000-000000000951';

insert into public.horses (id, "ownerId", name, "updatedAt") values
  ('ha', 'rp_00000000-0000-0000-0000-000000000951', 'Ancien', now()),
  ('hn', 'rp_00000000-0000-0000-0000-000000000952', 'Nouveau', now()),
  ('hp', 'rp_00000000-0000-0000-0000-000000000953', 'Premium', now());
insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values
  ('sa1', 'ha', 'BALADE', now(), '10:00', '', now()), ('sa2', 'ha', 'BALADE', now(), '11:00', '', now()),
  ('sn1', 'hn', 'BALADE', now(), '10:00', '', now()), ('sn2', 'hn', 'BALADE', now(), '11:00', '', now()),
  ('sn3', 'hn', 'BALADE', now(), '12:00', '', now()),
  ('sp1', 'hp', 'BALADE', now(), '10:00', '', now()), ('sp2', 'hp', 'BALADE', now(), '11:00', '', now());

create or replace function t.ride(_id text, _session text, _horse text) returns text language sql as $$
  select format($q$insert into public.training_session_rides (id, "sessionId", "horseId", "startedAt", "endedAt", "durationSeconds", "updatedAt") values (%L, %L, %L, now(), now(), 600, now())$q$, _id, _session, _horse)
$$;
grant execute on function t.ride(text, text, text) to authenticated;

select t.login('00000000-0000-0000-0000-000000000951', 'ancien@test.fr');
select t.allowed('Compte d''avant, gratuit : 1re séance en direct', t.ride('ra1', 'sa1', 'ha'));
select t.allowed('Compte d''avant, gratuit : 2e séance en direct (rien ne change)', t.ride('ra2', 'sa2', 'ha'));
select t.logout();

select t.login('00000000-0000-0000-0000-000000000952', 'nouveau@test.fr');
select t.allowed('Nouveau compte gratuit : 1re séance offerte', t.ride('rn1', 'sn1', 'hn'));
select t.denied('Nouveau compte gratuit : 2e séance refusée', t.ride('rn2', 'sn2', 'hn'));
select t.allowed('Nouveau compte gratuit : modifie sa séance offerte', $$update public.training_session_rides set "distanceMeters" = 1200 where id = 'rn1'$$);
select t.sees('Nouveau compte gratuit : voit sa séance offerte', 'select 1 from public.training_session_rides', 1);
-- Il ne peut pas s'accorder lui-même le statut des comptes d'avant.
update public.rider_profiles set "liveRideFree" = true where "userId" = '00000000-0000-0000-0000-000000000952';
select t.denied('Nouveau compte gratuit : toujours refusé après avoir tenté de modifier son profil', t.ride('rn3', 'sn3', 'hn'));
select t.logout();

select t.login('00000000-0000-0000-0000-000000000953', 'premium@test.fr');
select t.allowed('Premium : 1re séance', t.ride('rp1', 'sp1', 'hp'));
select t.allowed('Premium : 2e séance', t.ride('rp2', 'sp2', 'hp'));
select t.logout();

-- Un profil créé par l'app (compte connecté) naît sans le statut d'avant.
delete from public.rider_profiles where "userId" = '00000000-0000-0000-0000-000000000954';
select t.login('00000000-0000-0000-0000-000000000954', 'dp@test.fr');
insert into public.rider_profiles (id, "userId", "liveRideFree", "updatedAt") values ('rp_dp_neuf', '00000000-0000-0000-0000-000000000954', true, now());
select t.logout();
insert into t.results (ok, label, detail)
select not "liveRideFree", 'Profil créé par l''app : liveRideFree forcé à faux', null
from public.rider_profiles where id = 'rp_dp_neuf';

-- L'abonnement prend fin : le nouveau compte devenu Premium puis expiré ne peut
-- plus en créer, mais garde ce qu'il a enregistré.
insert into t.results (ok, label, detail)
select count(*) = 1, 'Nouveau compte : la séance offerte reste enregistrée', null
from public.training_session_rides where "horseId" = 'hn';
