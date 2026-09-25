-- Colonnes « niveau du concours » et « dernier jour » (schema.prisma, modèle
-- Appointment) absentes de la base. À exécuter UNE fois dans l'éditeur SQL
-- Supabase (prod), après relecture. Idempotent, sans effet sur les données
-- existantes (colonnes nullables).
--
-- Tant que ce SQL n'est pas passé, l'app garde ces deux champs sur le
-- téléphone uniquement (cloudSync.ts ne les envoie pas). Une fois passé, il
-- faudra les ajouter à la synchro (cloudSync.ts), dans une nouvelle version
-- de l'app.

alter table public.appointments
  add column if not exists "competitionLevel" text,
  add column if not exists "endDate" timestamp(3);

alter table public.appointments
  drop constraint if exists appointments_competition_level_check;
alter table public.appointments
  add constraint appointments_competition_level_check
  check ("competitionLevel" is null or "competitionLevel" in ('national', 'international'));
