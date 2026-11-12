-- Séance en direct Premium (1.3.0) — ÉTAPE 1 : à exécuter n'importe quand,
-- AVANT de déployer l'API de la 1.3.0 (Prisma lit cette colonne).
-- Rejouable, sans effet sur l'app : la colonne vaut VRAI pour tous les comptes,
-- existants comme ceux qui s'inscrivent jusqu'à l'étape 2. Personne ne perd
-- rien (cf. CLAUDE.md, rétrocompatibilité des droits).

alter table public.rider_profiles add column if not exists "liveRideFree" boolean not null default true;
