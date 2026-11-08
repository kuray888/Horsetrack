-- Écurie Pro v2, étape 1/2 (2026-11-08) — à exécuter SEULE dans l'éditeur SQL
-- Supabase (prod), avant l'étape 2. Idempotent.
--
-- Nouveaux rôles de partage : gérant, vétérinaire, maréchal. Postgres refuse
-- d'utiliser une nouvelle valeur d'énumération dans la transaction qui
-- l'ajoute : d'où deux scripts séparés.
alter type public.horse_collaborator_role add value if not exists 'MANAGER';
alter type public.horse_collaborator_role add value if not exists 'VET';
alter type public.horse_collaborator_role add value if not exists 'FARRIER';
