-- Colonnes « niveau du concours » et « dernier jour » (schema.prisma, modèle
-- Appointment) absentes de la base. À exécuter UNE fois dans l'éditeur SQL
-- Supabase (prod), après relecture. Idempotent, sans effet sur les données
-- existantes (colonnes nullables).
--
-- Le code de synchro (cloudSync.ts) gère déjà ces colonnes : tant qu'elles
-- manquent, il retombe sur l'ancien format ; une fois créées, niveau et
-- dernier jour se synchronisent sans nouvelle version de l'app.

alter table public.appointments
  add column if not exists "competitionLevel" text,
  add column if not exists "endDate" timestamp(3);

alter table public.appointments
  drop constraint if exists appointments_competition_level_check;
alter table public.appointments
  add constraint appointments_competition_level_check
  check ("competitionLevel" is null or "competitionLevel" in ('national', 'international'));
