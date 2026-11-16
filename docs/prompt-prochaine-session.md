# Prompt de la prochaine session (à coller tel quel)

Projet Horsetrack (monorepo ~/Developer/Horsetrack-reconcile : apps/mobile Expo, apps/api Next.js, apps/web site vitrine, packages/db Prisma/Supabase). Objectif de la session : **finir la 1.3.0 complète, prête à soumettre**, sur la branche `release/1.3.0`. Lis d'abord CLAUDE.md, docs/checklist-avant-soumission.md, docs/etat-des-lieux-2026-11-11.md, docs/audit-final-2026-11.md, docs/audit-premium-2026-11-11.md, les cahiers docs/seance-gps-relue.md, docs/meteo-repensee.md, docs/progression-cheval.md, docs/annuaire-professionnels.md, puis la mémoire du projet et `git log --oneline main..release/1.3.0`.

Je travaille en autonomie : avance sans me redemander, prends les meilleurs choix par défaut, teste toi-même tout ce qui se teste, et ne m'interromps que pour une décision vraiment à moi (prix, juridique, données personnelles, actions dans Apple / Supabase / Vercel / RevenueCat). Dis-moi quand tu as fini et ce que je dois faire à la main.

## Décisions déjà appliquées (ne pas les rouvrir)

- **La séance en direct (GPS) reste GRATUITE pour tous** : le verrou Premium du 2026-11-13 est annulé (code, base, docs, site). Seule la sécurité en balade (alerte à un proche) reste Premium. Ne jamais la verrouiller.
- **Gratuit resserré (2026-11-16, 1.3.0)** : pour les comptes gratuits créés à partir du 2026-11-20 (`FREE_TIER_V2_SINCE`, `rider_free_tier_restricted`) : 90 jours d'historique et de journal affichés, « Mon année » Premium, 1 objectif à la fois. Pour tous : bilan du mois des sorties Premium, rapport du mois en aperçu gratuit. SQL `palier-gratuit-2026-11-16.sql` déjà exécuté en production. Détail : CLAUDE.md § Formules et la mémoire `gratuit-resserre-1-3-0`.
- Premier travail de la session : mesurer l'effet (PostHog : `history_limit_reached`, `goal_limit_reached`, `ride_stats_viewed`, `monthly_report_previewed`, puis `paywall_viewed` par placement `history`, `goals`, `live_ride`) avant de resserrer davantage.

## Règles de travail (non négociables)
- Commits en français : effet pour l'utilisateur + cause d'un bug, avec la ligne d'attribution du système. Petits lots sûrs sur `release/1.3.0`. Pousser `release/1.3.0` est autorisé ; jamais de merge dans `main` ni de build sans mon accord.
- RÈGLE ABSOLUE : un abonné ou un utilisateur existant ne perd AUCUNE fonctionnalité. Toute évolution de droits ou de RLS se rejoue sur l'ancien état de la prod et se couvre par un test `test:rls`.
- Cause racine d'abord, test qui échoue d'abord, puis correction. Logique pure séparée des écrans, testée avec vitest.
- Conformité App Store (CLAUDE.md § Conformité) vérifiée AVANT toute modification du paywall, de l'achat, du compte, de la localisation ou de toute donnée envoyée à un tiers.
- Chaque texte passe par `t()` avec sa traduction anglaise ; relis chaque écran modifié en anglais. Toute fonctionnalité envoie au moins un événement d'usage typé, sans donnée personnelle. Aucune relance hors du tableau de CLAUDE.md.
- Vérifie ce qui est EN LIGNE, pas seulement le code : `tools/check-prod.sh` au début et avant de dire « prêt ».

## Mission 0 — État des lieux (court)
1. Statut de la 1.2.0 (build n° 30) dans App Store Connect : demande-le-moi si tu ne peux pas le voir.
2. `tools/check-prod.sh`, `git status`, liste des commits de `release/1.3.0` et ce qu'il reste dans les cahiers des quatre chantiers.
3. Une page claire « contenu de la 1.3.0 » : ce qui est fini, à finir, à reporter.

## Mission 1 — Annuler le verrou de la séance en direct (ci-dessus), en premier.

## Mission 2 — Finir les chantiers de la 1.3.0, par ordre d'impact
Pour chacun, reprends son cahier dans docs/, termine les jalons prévus pour la 1.3.0 et reporte explicitement le reste.
1. **Séance GPS relue** (gratuite) : carte du tracé, vitesse, allures, dénivelé lissé, relecture 2D, partage de la carte en story (déjà commencé : `8228b5f`), export GPX. Traces supprimées avec le compte. Hors ligne et séance interrompue gérés.
2. **Météo repensée** : finir l'écran (bonne tenue, créneau pour monter en Premium, alertes gratuites), attribution du fournisseur, états hors ligne et données manquantes.
3. **Progression du cheval** : la logique J1 existe (`06bd6e8`) ; écran lisible, graphiques SVG légers et accessibles, carte partageable.
4. **Annuaire / Mes contacts** : appel, itinéraire, rappel de prochaine visite depuis un contact (phase 1 du cahier uniquement).
5. **Partage gratuit en lecture seule** : déjà livré (`9c06e5d`, `7681857`) ; vérifie-le de bout en bout sur deux comptes et corrige le texte d'introduction de l'écran de partage, qui promet encore « lire et écrire sur […] les concours, le journal et le budget » alors que les droits dépendent du rôle (la description par rôle, elle, est juste).

## Mission 3 — Qualité avant soumission
- Matrice des pires moments sur les écrans touchés : hors ligne, chargement, vide, erreur serveur, refus de permission (localisation, photos, notifications), séance interrompue, gratuit / essai / Premium / Premium offert, 1 vs N chevaux, cheval partagé, palettes sombres, anglais, VoiceOver, « Réduire les animations ».
- Synchronisation : un correctif est déjà poussé (`2ddb3e6`, profil serveur recréé s'il manque). Contexte : une cliente inscrite en septembre avec un Premium offert a perdu des chevaux et des documents en changeant de téléphone, parce que le serveur ne reconnaissait pas son Premium avant le 30/09. Vérifie qu'aucun autre chemin ne peut laisser une donnée uniquement sur le téléphone sans l'indiquer à l'utilisateur (bannière « non synchronisé », lisible et avec une issue).
- Revue sur simulateur des parcours Maestro (`apps/mobile/.maestro`), captures avant/après des écrans modifiés.

## Données de démonstration
Compte lealilou@icloud.com : c'est aussi le vrai compte de ma compagne. Mot de passe : demande-le-moi, jamais dans un fichier ni un commit. Son Premium est un « Premium offert » RevenueCat (le Profil affiche « Premium offert » après connexion ; quelques secondes peuvent être nécessaires). Ne jamais modifier ni supprimer ses vraies données ; tout ajout porte un identifiant `demo_*` et est retiré à la fin, avec une comparaison ligne à ligne avant/après. Scripts : tools/store-screenshots/demo-data/. Le compte contient encore 11 dépenses et 3 souvenirs `demo_store_*` du 11/11 : demande-moi avant de les retirer.

## Livrables
1. Le verrou de la séance en direct retiré (app, serveur, tests, docs, site), commité et poussé sur `release/1.3.0`.
2. Les chantiers de la 1.3.0 finis par petits lots testés, et la page « contenu de la 1.3.0 ».
3. docs/checklist-avant-soumission.md passée en entier, et la liste exacte de ce que je dois faire à la main (SQL Supabase dans l'ordre, déploiement de l'API, App Store Connect, site), pour pouvoir lancer le build de la 1.3.0.

## Vérifications avant « fini »
apps/mobile : `npx tsc --noEmit`, `pnpm --filter @cheval/mobile test`, eslint des fichiers modifiés. apps/api et apps/web : `npx tsc --noEmit`, `npx vitest run`, `npx next build`. `pnpm --filter @cheval/db test:rls` (Postgres local : PATH=/opt/homebrew/opt/postgresql@16/bin, `pg_ctl -D /opt/homebrew/var/postgresql@16 -o "-k /tmp" -l /tmp/pg16.log start`, PGHOST=/tmp). `tools/check-prod.sh`. Maestro : `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`.
