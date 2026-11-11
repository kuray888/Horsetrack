-- Lecture des photos de chevaux et de souvenirs (bucket « horse-photos ») :
-- propriétaire et équipe acceptée du cheval. Rejouable sans risque : si la
-- policy existe déjà en prod (créée avant le 2026-09-07), elle est recréée
-- à l'identique. Cf. rls.sql § 6 et tests/rls/80-stockage.test.sql.
drop policy if exists "horse_photos_select_shared" on storage.objects;
create policy "horse_photos_select_shared" on storage.objects
  for select using (bucket_id = 'horse-photos' and public.can_access_horse((storage.foldername(name))[1]));
