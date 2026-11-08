-- Écurie Pro, étape 1/2 (2026-11-08) — à exécuter SEULE dans l'éditeur SQL
-- Supabase (prod), avant l'étape 2. Idempotent.
--
-- Postgres refuse d'utiliser une nouvelle valeur d'énumération dans la
-- transaction qui l'ajoute : d'où deux scripts séparés.
alter type public.subscription_tier add value if not exists 'PRO';
