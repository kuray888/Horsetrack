# Prompt de la prochaine session (à coller tel quel)

Projet Horsetrack (monorepo ~/Developer/Horsetrack-reconcile : apps/mobile Expo, apps/api Next.js, apps/web site vitrine, packages/db Prisma/Supabase). Lis d'abord CLAUDE.md, puis docs/audit-final-2026-11.md, docs/audit-ux-premium-2026-11.md, docs/checklist-avant-soumission.md, docs/soumission-app-store-1.2.0.md et la mémoire du projet. Je travaille en autonomie : avance sans me redemander, fais les meilleurs choix, teste toi-même tout ce qui se teste, et dis-moi quand tu as fini ou quand j'ai une étape à faire à la main.

## Ambition
Faire de Horsetrack LA référence du suivi du cheval : celle qu'on ouvre tous les jours (rétention), qu'on recommande (acquisition) et pour laquelle on paie sans hésiter (conversion). On construit comme les meilleures applications grand public : valeur comprise en moins de 30 s, un geste quotidien qui crée l'habitude, une preuve sociale honnête, un paywall clair. **On mesure avant de construire, et on ne livre que ce qui est testé.**

## Règles de travail (non négociables)
- Jamais de push ni de merge sans ma demande explicite. Commits en français : effet pour l'utilisateur + cause d'un bug, avec la ligne d'attribution du système. La version à publier se prépare sur `release/<version>` (cf. CLAUDE.md § Git), par petits lots sûrs.
- RÈGLE ABSOLUE : mes abonnés existants ne perdent AUCUNE fonctionnalité ; toute évolution de droits ou de RLS se rejoue sur l'ancien état de la prod et se couvre par un test `test:rls`.
- Cause racine d'abord, test qui échoue d'abord, puis correction. Logique pure séparée des écrans, testée avec vitest. Écris les gros fichiers en plusieurs morceaux ; le React Compiler fait échouer le lint si on lit des propriétés d'objet dans un retour anticipé ou un useMemo.
- Conformité App Store (CLAUDE.md § Conformité) vérifiée AVANT toute modif du paywall, de l'achat, du compte, et de tout contenu généré par les utilisateurs (règle 1.2 : signalement, blocage, modération, CGU), des données envoyées à une IA tierce (règle 5.1.2(i) : accord explicite) et de la localisation.
- Chaque texte passe par `t()` avec sa traduction anglaise (test). Les relances suivent le tableau de CLAUDE.md : aucune nouvelle relance hors tableau. Toute fonctionnalité envoie au moins un événement d'usage typé, sans donnée personnelle.
- Données de démonstration : compte lealilou@icloud.com (mot de passe : demande-le-moi, jamais dans un fichier ni un commit). Attention : serveur ACTIVE mais aucun achat RevenueCat, donc gratuit sur un simulateur neuf. Scripts dans tools/store-screenshots/demo-data/ ; tout ajout porte un identifiant `demo_*`, tout est supprimé à la fin ; état de référence : 63 séances, 38 rendez-vous, 0 dépense, 0 journal.

## Leçons de la 1.2.0 (à ne pas refaire)
- Vérifier ce qui est EN LIGNE, pas seulement le code : lance `tools/check-prod.sh` au début et avant chaque soumission (l'API de production avait pris du retard sur le code).
- Relire chaque écran en anglais (paywall : « per an », « 1 months » ont failli partir) et les messages d'erreur (jamais de texte technique brut, un message précis par cause, une issue proposée).
- Ne jamais envoyer de donnée à un tiers (IA, analytics) sans l'avoir dit et demandé.
- Un build n'est pas « la version » : numéro de version = App Store Connect, numéro de build = automatique. Un build part d'un arbre propre ET poussé (ou au moins tagué).
- Les caches serveur ignoraient la langue : toute donnée mise en cache dépend de sa langue.

## Mission 0 — État des lieux (avant tout code)
1. Où en est la 1.2.0 : build n° 30 envoyé ? version soumise, en revue, refusée (lis le motif) ou publiée ? Lance `tools/check-prod.sh`.
2. Ce qui n'a pas été fait : déploiement de l'API de production (planning/notify, en-têtes, langue du coach), fusion et poussée des branches dans l'ordre release/1.1.3 → onboarding/compte-apres-cheval → v1.2 → pro/planning (prépare, ne pousse pas sans mon accord), report de 136e81b sur main (build Vercel), visuels anglais de l'App Store (il faut un Premium actif sur le simulateur), tests réels (achat sandbox, deux appareils, /gestion).
3. Demande-moi les chiffres : téléchargements, installations → onboarding terminé → paywall vu → essai démarré → payant (RevenueCat, App Store Connect, PostHog), rétention J1/J7/J30, avis. Sans chiffres, propose d'abord le tableau de bord à mettre en place (événements du tunnel de CLAUDE.md § Analytics).

## Mission 1 — Conversion et rétention (ce qui rapporte le plus, en premier)
Pour chaque point : constat mesuré ou observé sur l'app, hypothèse, changement minimal, expérience (`EXPERIMENTS` dans lib/experiments.ts, livrée `enabled: false`, témoin = comportement actuel ; les prix se testent seulement via RevenueCat Experiments), critère de réussite, risque.
- **Première minute** : onboarding le plus court possible, un toucher par question, premier succès immédiat (le cheval créé, une première séance, un premier rappel). Mesure du temps jusqu'à la première valeur.
- **Habitude quotidienne** : une raison d'ouvrir l'app chaque jour (séance du jour, série de jours actifs, bilan de semaine partageable), sans spam (tableau des relances).
- **Paywall** : clarté et confiance d'abord (prix facturé le plus visible, essai, date de paiement, résiliation), puis expériences de contenu (bénéfices, ordre, preuve sociale réelle, horloge de l'essai honnête). Jamais de faux compte à rebours, fausse rareté, avis inventés, prix barré jamais pratiqué.
- **Acquisition** : ASO (titre, sous-titre, mots-clés, tests de page produit Apple), cartes partageables de l'année/séance avec la marque, parrainage, demande d'avis aux bons moments.
- **Design premium** : audit d'écran par écran face aux meilleures apps (hiérarchie, espacement 4/8, typographie, couleurs du thème, micro-interactions, états vides avec action, squelettes, retours après action : toast avec « Annuler », composant d'état vide partagé). Reprendre les points ouverts de docs/audit-ux-premium-2026-11.md § 3.
- **Performance** : démarrage (startupTrace), listes paginées, taille du bundle.

## Mission 2 — Nouvelles fonctionnalités, dans cet ordre de valeur / risque
Pour chacune : cahier des charges court (docs/…), ce qui est gratuit et ce qui est Premium, conformité, coûts, événements d'usage, plan de test, jalon (version). Je valide le cahier des charges AVANT le gros du code.
1. **Séance GPS relue** (suite naturelle de la séance en direct) : carte du tracé, relecture animée, vitesse, allures, dénivelé (altitude lissée : le GPS brut est bruité), chronomètre intelligent (intervalles, allures, objectifs), export. Carte native = nouveau module : prévoir un build de développement et vérifier Expo/EAS. 3D en dernier, seulement si la 2D est utilisée.
2. **Météo repensée** : lisibilité immédiate (la bonne tenue, le bon créneau pour monter), design aligné sur le thème.
3. **Progression visuelle du cheval** : courbes et jalons (poids, charge de travail, régularité, concours, soins), comparaisons dans le temps, carte partageable. Réutiliser les données existantes.
4. **Annuaire de professionnels** (vétos, maréchaux, ostéos, coachs) : commencer par « mes contacts » enrichis puis un annuaire partagé ; vérification des fiches, avis modérés, RGPD, aucun avis inventé.
5. **Communauté** (s'ajouter entre cavaliers, fil, défis) : seulement en version légère d'abord (amis, partage de séances/cartes). Exige modération, signalement, blocage, CGU, RGPD, coût d'hébergement : cahier des charges juridique et technique avant toute ligne de code.
6. **Marketplace** : le plus risqué (paiements, règle 3.1.1 pour les biens numériques, fraude, litiges, modération). Ne pas coder avant d'avoir mesuré la demande (liste d'attente, annonces en lecture seule) et décidé du modèle (Stripe pour des biens physiques entre particuliers ; rien de payant sans avis juridique).
7. **Écurie Pro** : en pause (`PRO_ENABLED = false`). À rouvrir seulement avec un nom, un positionnement et des prix validés ; ne jamais retirer ce qui est ouvert à Premium.

## Livrables attendus
1. Un rapport d'état (Mission 0), puis un plan priorisé par impact attendu sur la conversion/rétention, effort et risque, avec les expériences à lancer.
2. Les corrections et fonctionnalités validées, commitées par petits lots testés (pas de push), sur `release/<version>`.
3. La liste de ce que je dois faire à la main (Apple, Supabase, Vercel), et docs/checklist-avant-soumission.md passée en entier avant chaque build.

## Vérifications avant « fini »
apps/mobile : `npx tsc --noEmit`, `pnpm --filter @cheval/mobile test`, eslint des fichiers modifiés (zsh : via xargs). apps/api et apps/web : `npx tsc --noEmit`, `npx vitest run`, `npx next build`. `pnpm --filter @cheval/db test:rls` (Postgres local : PATH=/opt/homebrew/opt/postgresql@16/bin, `pg_ctl -D /opt/homebrew/var/postgresql@16 -o "-k /tmp" -l /tmp/pg16.log start`, PGHOST=/tmp). `tools/check-prod.sh`.
