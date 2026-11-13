-- Séance en direct : GRATUITE pour tous (décision du 2026-11-13, elle a été
-- annoncée gratuite en 1.2.0). Aucun compte, ancien ou nouveau, n'est limité.
select t.add_user('00000000-0000-0000-0000-000000000951', 'ancien@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000952', 'nouveau@test.fr');

insert into public.horses (id, "ownerId", name, "updatedAt") values
  ('ha', 'rp_00000000-0000-0000-0000-000000000951', 'Ancien', now()),
  ('hn', 'rp_00000000-0000-0000-0000-000000000952', 'Nouveau', now());
insert into public.training_sessions (id, "horseId", "activityType", date, time, notes, "updatedAt") values
  ('sa1', 'ha', 'BALADE', now(), '10:00', '', now()), ('sa2', 'ha', 'BALADE', now(), '11:00', '', now()),
  ('sn1', 'hn', 'BALADE', now(), '10:00', '', now()), ('sn2', 'hn', 'BALADE', now(), '11:00', '', now()),
  ('sn3', 'hn', 'BALADE', now(), '12:00', '', now());

create or replace function t.ride(_id text, _session text, _horse text) returns text language sql as $$
  select format($q$insert into public.training_session_rides (id, "sessionId", "horseId", "startedAt", "endedAt", "durationSeconds", "updatedAt") values (%L, %L, %L, now(), now(), 600, now())$q$, _id, _session, _horse)
$$;
grant execute on function t.ride(text, text, text) to authenticated;

select t.login('00000000-0000-0000-0000-000000000951', 'ancien@test.fr');
select t.allowed('Compte gratuit d''avant : 1re séance en direct', t.ride('ra1', 'sa1', 'ha'));
select t.allowed('Compte gratuit d''avant : 2e séance en direct', t.ride('ra2', 'sa2', 'ha'));
select t.logout();

select t.login('00000000-0000-0000-0000-000000000952', 'nouveau@test.fr');
select t.allowed('Nouveau compte gratuit : 1re séance en direct', t.ride('rn1', 'sn1', 'hn'));
select t.allowed('Nouveau compte gratuit : 2e séance en direct', t.ride('rn2', 'sn2', 'hn'));
select t.allowed('Nouveau compte gratuit : 3e séance en direct', t.ride('rn3', 'sn3', 'hn'));
select t.allowed('Nouveau compte gratuit : modifie sa séance', $$update public.training_session_rides set "distanceMeters" = 1200 where id = 'rn1'$$);
select t.sees('Nouveau compte gratuit : voit ses 3 séances', 'select 1 from public.training_session_rides', 3);
select t.logout();
