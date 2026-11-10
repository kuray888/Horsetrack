# Prompt de la prochaine session (à coller tel quel)

Projet Horsetrack (monorepo ~/Developer/Horsetrack-reconcile). Lis d'abord CLAUDE.md, docs/fiche-app-store.md et ce fichier. Je travaille en autonomie : avance sans me redemander, fais les meilleurs choix, dis-moi quand c'est fini ou quand j'ai une étape à faire. Jamais de push ni de merge sans que je le demande. Commits en français (effet pour l'utilisateur + cause d'un bug) avec la ligne d'attribution du système. RÈGLE ABSOLUE : mes abonnés existants ne perdent aucune fonctionnalité. Mot de passe du compte de démonstration lealilou@icloud.com : demande-le-moi au moment de lancer capture.sh, ne l'écris jamais dans un fichier ni un commit.

## Où on en est
- Branche pro/planning (origin = 04c77f2 ; 8 commits locaux non poussés, dernier c187f4e). Rien n'est fusionné ; main = l'ancien site.
- Écurie Pro est EN PAUSE dans l'app (PRO_ENABLED = false, apps/mobile/src/lib/features.ts) : la 1.2.0 ne propose que Premium (3,99 €/mois, 39,99 €/an, 1 mois d'essai). Base, API et /gestion restent en place. Pro sera proposé plus tard, sous un autre nom / une autre plateforme.
- Ouvert à Premium : créneaux réguliers (SQL ecurie-pro-v2-9-creneaux-premium-2026-11-10.sql, à exécuter dans Supabase), rapport du mois en PDF, export des dépenses (PDF, CSV), coach IA (30 questions/mois).
- Build EAS 1.2.0 n° 26 (f7bebe89) soumis à App Store Connect, MAIS il ne contient pas : « Coach IA » nommé comme tel (écran coach + carte Accueil) ni la correction des icônes des puces (séance en direct, écran Équipe). Ces deux changements sont dans les commits 43c0fc4 et suivants : il faut un nouveau build avant de soumettre à la revue.
- Visuels App Store : tools/store-screenshots (npm run render → out/fr/<jeu>/). 10 visuels FR en 3 jeux (soins par défaut, coach, ecurie). Captures brutes : raw/fr (hub, sante, today, planning, coach, budget, partage, journal, ride, ride-setup), copie sans design dans out/captures-brutes. Médaille « 5,0 · 11 avis » (RATING dans screens.mjs) : chiffres réels à tenir à jour.

## À faire, dans cet ordre
1. Si je le demande : pousser pro/planning ; lancer `eas build --platform ios --profile production` (apps/mobile) puis `eas submit --platform ios --profile production --latest`.
2. Jeu anglais des visuels : repasser le simulateur iPhone 17 Pro Max (C3664CD7-77AD-4683-BF0D-CB24571EA5C0) en anglais, remplir le compte de démonstration (script seed du scratchpad ou à refaire : identifiants demo_store_*, tout supprimer après), lancer capture.sh en, puis store-extra.yaml et store-ride.yaml. Maestro : JAVA_HOME=/opt/homebrew/opt/openjdk@17 et PATH avec openjdk@17/bin ; l'app Release du simulateur se recompile avec xcodebuild (variables du profil simulator d'eas.json).
3. Tests réels : /gestion connecté, achat Premium en sandbox, créneaux Premium (après le SQL v2-9).
4. Fusion dans l'ordre release/1.1.3 → onboarding/compte-apres-cheval → v1.2 → pro/planning (préparer, ne pas pousser sans mon accord) ; reporter 136e81b sur main pour réparer sa build Vercel.

## Limites connues, laissées volontairement
Tracé GPS du visuel presque droit (simulateur) ; /gestion sur le domaine du site ; Pro non vendu. Gros chantiers différés : /gestion en écriture, chevaux de clients.

## Vérifications avant « fini »
apps/mobile : npx tsc --noEmit + pnpm --filter @cheval/mobile test + eslint des fichiers modifiés (zsh : via xargs) ; apps/api et apps/web : npx tsc --noEmit + npx vitest run ; pnpm --filter @cheval/db test:rls (Postgres local : PATH=/opt/homebrew/opt/postgresql@16/bin, pg_ctl -D /opt/homebrew/var/postgresql@16 -o "-k /tmp" -l /tmp/pg16.log start, PGHOST=/tmp).
