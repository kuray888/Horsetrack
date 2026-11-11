-- Fichiers (Supabase Storage) : une personne ne lit, ne remplace ni ne
-- supprime jamais le fichier d'une autre en devinant son chemin.
-- Coffre-fort : documents/{userId}/… ; photos : horse-photos/{horseId}/….

select t.add_user('00000000-0000-0000-0000-000000000081', 'proprio@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000082', 'inconnu@test.fr', 'GRAND_PRIX', 'ACTIVE');
select t.add_user('00000000-0000-0000-0000-000000000083', 'dp@test.fr');
select t.add_user('00000000-0000-0000-0000-000000000084', 'gratuit@test.fr');

insert into public.horses (id, "ownerId", name, "updatedAt") values
  ('hs', 'rp_00000000-0000-0000-0000-000000000081', 'Sirius', now()),
  ('hg', 'rp_00000000-0000-0000-0000-000000000084', 'Gratte', now());
insert into public.horse_collaborators (id, "horseId", "invitedEmail", role, status, "collaboratorUserId", "expiresAt", "updatedAt")
  values ('cs', 'hs', 'dp@test.fr', 'RIDER', 'ACCEPTED', '00000000-0000-0000-0000-000000000083', now() + interval '14 days', now());
insert into storage.objects (bucket_id, name) values
  ('documents', '00000000-0000-0000-0000-000000000081/ordonnance.jpg'),
  ('horse-photos', 'hs/photo.jpg'),
  ('horse-photos', 'hs/journal/j1.jpg');

-- Propriétaire.
select t.login('00000000-0000-0000-0000-000000000081', 'proprio@test.fr');
select t.sees('Propriétaire : voit son ordonnance', $$select 1 from storage.objects where bucket_id = 'documents'$$, 1);
select t.sees('Propriétaire : voit les photos de son cheval', $$select 1 from storage.objects where bucket_id = 'horse-photos'$$, 2);
select t.allowed('Propriétaire : ajoute un document', $$insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-000000000081/facture.jpg')$$);
select t.allowed('Propriétaire : remplace la photo du cheval', $$update storage.objects set owner = '00000000-0000-0000-0000-000000000081' where name = 'hs/photo.jpg'$$);
select t.allowed('Propriétaire Premium : photo de souvenir', $$insert into storage.objects (bucket_id, name) values ('horse-photos', 'hs/journal/j2.jpg')$$);
select t.denied('Propriétaire : pas dans le dossier d''un autre', $$insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-000000000082/x.jpg')$$);
select t.logout();

-- Inconnu (autre compte, même Premium) : rien, même en connaissant le chemin.
select t.login('00000000-0000-0000-0000-000000000082', 'inconnu@test.fr');
select t.sees('Inconnu : ne voit pas l''ordonnance', $$select 1 from storage.objects where name = '00000000-0000-0000-0000-000000000081/ordonnance.jpg'$$, 0);
select t.sees('Inconnu : ne voit pas la photo du cheval', $$select 1 from storage.objects where name = 'hs/photo.jpg'$$, 0);
select t.denied('Inconnu : ne remplace pas la photo', $$update storage.objects set owner = '00000000-0000-0000-0000-000000000082' where name = 'hs/photo.jpg'$$);
select t.denied('Inconnu : ne supprime pas l''ordonnance', $$delete from storage.objects where bucket_id = 'documents'$$);
select t.denied('Inconnu : ne dépose rien sur le cheval', $$insert into storage.objects (bucket_id, name) values ('horse-photos', 'hs/photo2.jpg')$$);
select t.logout();

-- Demi-pension acceptée : voit les photos du cheval, jamais le coffre-fort
-- du propriétaire, et ne modifie rien.
select t.login('00000000-0000-0000-0000-000000000083', 'dp@test.fr');
select t.sees('Demi-pension : voit les photos du cheval partagé', $$select 1 from storage.objects where bucket_id = 'horse-photos'$$, 3);
select t.sees('Demi-pension : ne voit pas le coffre-fort', $$select 1 from storage.objects where bucket_id = 'documents'$$, 0);
select t.denied('Demi-pension : ne supprime pas la photo', $$delete from storage.objects where name = 'hs/photo.jpg'$$);
select t.denied('Demi-pension : ne remplace pas la photo', $$insert into storage.objects (bucket_id, name) values ('horse-photos', 'hs/photo.jpg')$$);
select t.logout();

-- Partage retiré : plus aucune photo.
delete from public.horse_collaborators where id = 'cs';
select t.login('00000000-0000-0000-0000-000000000083', 'dp@test.fr');
select t.sees('Ancienne demi-pension : ne voit plus les photos', $$select 1 from storage.objects where bucket_id = 'horse-photos'$$, 0);
select t.logout();

-- Gratuit : photo de profil oui, photo de souvenir (Premium) non.
select t.login('00000000-0000-0000-0000-000000000084', 'gratuit@test.fr');
select t.allowed('Gratuit : photo de son cheval', $$insert into storage.objects (bucket_id, name) values ('horse-photos', 'hg/photo.jpg')$$);
select t.denied('Gratuit : pas de photo de souvenir', $$insert into storage.objects (bucket_id, name) values ('horse-photos', 'hg/journal/j.jpg')$$);
select t.logout();

-- Visiteur non connecté (clé anon) : rien.
set role anon;
select t.denied('Anonyme : aucun fichier (refus ou rien)', 'select 1 from storage.objects');
reset role;
