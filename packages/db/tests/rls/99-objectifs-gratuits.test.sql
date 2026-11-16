-- Palier gratuit resserré : un objectif à la fois pour un compte gratuit créé
-- à partir du 2026-11-20 ; rien ne change pour les autres.
select t.add_user('00000000-0000-0000-0000-000000000991', 'ancien@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000992', 'nouveau@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000993', 'nouveau-premium@test.fr', 'GRAND_PRIX', 'ACTIVE');
update auth.users set created_at = '2026-11-01' where id = '00000000-0000-0000-0000-000000000991';
update auth.users set created_at = '2026-11-21' where id in ('00000000-0000-0000-0000-000000000992', '00000000-0000-0000-0000-000000000993');

select t.login('00000000-0000-0000-0000-000000000991', 'ancien@test.fr');
select t.allowed('Ancien compte gratuit : 1er objectif', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('ga1', 'rp_00000000-0000-0000-0000-000000000991', 'A', now())$$);
select t.allowed('Ancien compte gratuit : 2e objectif, comme avant', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('ga2', 'rp_00000000-0000-0000-0000-000000000991', 'B', now())$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000992', 'nouveau@test.fr');
select t.allowed('Nouveau compte gratuit : 1er objectif', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('gn1', 'rp_00000000-0000-0000-0000-000000000992', 'A', now())$$);
select t.denied('Nouveau compte gratuit : pas de 2e objectif', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('gn2', 'rp_00000000-0000-0000-0000-000000000992', 'B', now())$$);
select t.allowed('Nouveau compte gratuit : modifie son objectif (upsert)', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('gn1', 'rp_00000000-0000-0000-0000-000000000992', 'A2', now()) on conflict (id) do update set title = excluded.title$$);
select t.logout();

select t.login('00000000-0000-0000-0000-000000000993', 'nouveau-premium@test.fr');
select t.allowed('Nouveau compte Premium : 1er objectif', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('gp1', 'rp_00000000-0000-0000-0000-000000000993', 'A', now())$$);
select t.allowed('Nouveau compte Premium : 2e objectif', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('gp2', 'rp_00000000-0000-0000-0000-000000000993', 'B', now())$$);
select t.logout();

-- Fin d'essai : les objectifs restent, modifiables ; seul l'ajout est refusé.
update public.rider_profiles set "subscriptionStatus" = 'EXPIRED' where id = 'rp_00000000-0000-0000-0000-000000000993';
select t.login('00000000-0000-0000-0000-000000000993', 'nouveau-premium@test.fr');
select t.sees('Fin d''abonnement : garde ses 2 objectifs', 'select 1 from public.goals', 2);
select t.allowed('Fin d''abonnement : modifie un objectif', $$update public.goals set title = 'C' where id = 'gp2'$$);
select t.denied('Fin d''abonnement : pas de 3e objectif', $$insert into public.goals (id, "riderId", title, "updatedAt") values ('gp3', 'rp_00000000-0000-0000-0000-000000000993', 'D', now())$$);
select t.logout();
