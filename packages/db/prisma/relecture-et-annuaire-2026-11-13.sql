-- 1.3.0 : relecture des séances en direct et « Mes contacts » enrichi (2026-11-13).
-- À exécuter AVANT de déployer l'API et de publier la 1.3.0. Additive et rejouable :
-- aucune donnée existante n'est modifiée, les téléphones en 1.2.0 continuent de
-- fonctionner (ils n'envoient pas ces colonnes). Les règles RLS existantes couvrent
-- les nouvelles colonnes (elles portent sur la ligne, pas sur la colonne).

-- Trace détaillée d'une séance : JSON compact aligné sur la polyligne `route`
-- (secondes depuis le départ, vitesse en dixièmes de km/h, altitude en dm).
alter table public.training_session_rides add column if not exists "trace" text;

-- Adresse d'un contact (itinéraire dans Plans). Carnet personnel : RLS userId = auth.uid().
alter table public.rider_contacts add column if not exists "address" text not null default '';
