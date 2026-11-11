# Prompt : poursuite de la production + dernier check-up complet (à coller tel quel)

Projet Horsetrack (monorepo ~/Developer/Horsetrack-reconcile : apps/mobile Expo, apps/api Next.js, apps/web site vitrine, packages/db Prisma/Supabase). Lis d'abord CLAUDE.md, docs/prompt-prochaine-session.md (état exact), docs/fiche-app-store-1.2.0.md et docs/ecurie-pro.md (Pro en pause). Je travaille en autonomie : avance sans me redemander, fais les meilleurs choix, teste toi-même tout ce qui se teste, et dis-moi quand tu as fini ou quand j'ai une étape à faire.

## Règles de travail
- Jamais de push ni de merge sans que je le demande. Commits en français (effet pour l'utilisateur + cause d'un bug) avec la ligne d'attribution que le système te donne.
- RÈGLE ABSOLUE : mes abonnés existants ne perdent AUCUNE fonctionnalité (CLAUDE.md § Formules, mémoire « abonnes-existants-gardent-leurs-droits »). Toute évolution de droits ou de RLS se rejoue sur l'ancien état de la prod (c315fbd) et se couvre par un test test:rls.
- Chasse aux bugs selon CLAUDE.md : cause racine d'abord, test qui échoue d'abord, puis correction. Pièges : le React Compiler fait échouer le lint si on lit des propriétés d'objet dans un retour anticipé ou un useMemo ; écris les gros fichiers en plusieurs morceaux.
- Données de démonstration : compte lealilou@icloud.com (mot de passe : demande-le-moi au moment d'en avoir besoin, jamais dans un fichier ni un commit). Tout ce que tu y ajoutes porte un identifiant demo_* et tu le supprimes à la fin ; remets le compte dans l'état d'avant (63 séances, 38 rendez-vous, 0 dépense, 0 journal au 2026-11-10).

## Où on en est (résumé ; détail dans docs/prompt-prochaine-session.md)
Branche pro/planning, plusieurs commits locaux non poussés. Écurie Pro en pause (PRO_ENABLED = false). Premium : créneaux, rapport du mois, export des dépenses, coach IA. Build EAS 1.2.0 n° 26 soumis mais sans les mentions « Coach IA » ni la correction des icônes des puces : un nouveau build est nécessaire avant la revue Apple. Version App Store Connect : doit s'appeler exactement 1.2.0 (comme le build).

## Mission 1 — Dernier check-up complet, avant la revue Apple
Objectif : trouver et corriger ce qui ferait perdre des données, des abonnés ou la confiance. Livre un rapport court (sévérité, cause, correction ou décision à prendre) et corrige tout ce qui est sûr.

### A. Synchronisation entre plusieurs appareils (priorité 1)
Vérifie que documents, photos et informations se synchronisent bien d'un appareil à l'autre, dans les deux sens, et ne se perdent jamais.
- Code à lire : apps/mobile/src/lib/cloudSync.ts, src/lib/sync/* (appointments, documents, expenses, extras, fees, horses, journal, sessions, shared, slots, tasks, weight), src/lib/syncQueue.ts (+ test), useSyncQueue.ts, imagePicker.ts (photos → Documents, bucket « documents » du coffre-fort, rls.sql § 5), subscriptionSync.ts.
- Scénarios à rejouer, et à couvrir par des tests vitest (logique pure séparée des écrans) :
  1. Deux appareils connectés au même compte : ajout, modification et suppression d'un cheval, d'une séance, d'un soin, d'une dépense, d'un souvenir de journal, d'un poids, d'un objectif ; chacun doit apparaître sur l'autre sans doublon.
  2. Hors ligne : écrire sur A hors ligne, écrire sur B en ligne, puis reconnecter A. Règle de conflit (dernier écrit ? fusion ?) cohérente et sans perte silencieuse. File d'attente : reprise après coupure, ordre, doublons, éléments bloqués.
  3. Photos et documents : photo du cheval, photo d'un souvenir, ordonnance/facture du coffre-fort. Envoi vers Supabase Storage, téléchargement sur l'autre appareil, cache, fichier supprimé d'un côté, photo remplacée, gros fichier, réseau coupé en plein envoi, suppression du compte (les fichiers partent-ils ?).
  4. Cheval partagé : propriétaire + demi-pension/coach/groom. Ce que chacun voit et peut modifier (droits par rôle, rôle LEGACY des anciens partages), synchro dans les deux sens, retrait d'un membre, fin de l'abonnement du propriétaire (lecture seule, pas de perte).
  5. Déconnexion / reconnexion / réinstallation : rien d'écrit en local seulement ne doit disparaître sans que l'utilisateur le sache ; compte supprimé ; deuxième compte sur le même téléphone (aucune fuite de données d'un compte à l'autre via le stockage local).
  6. Changement d'abonnement (gratuit → Premium → expiré) : limites appliquées côté serveur ET reflétées dans l'app ; chevaux verrouillés conservés ; Premium offert / code promo / ancien abonné.
- Test réel : si tu peux, lance deux simulateurs iOS (ou un simulateur + un second compte) et reproduis les scénarios 1 à 3 pour de vrai. Environnement : tools/store-screenshots et .maestro/ (Maestro : JAVA_HOME=/opt/homebrew/opt/openjdk@17, PATH avec openjdk@17/bin ; build Release simulateur avec xcodebuild, variables du profil simulator d'eas.json). Les chemins takeScreenshot doivent être relatifs.

### B. Sécurité
- RLS (packages/db/prisma/rls.sql et ecurie-pro-v2-*.sql) : une personne peut-elle lire ou écrire les données d'un autre ? Tables, vues, fonctions security definer (search_path), bucket Storage « documents », storage.objects (un utilisateur peut-il lire le fichier d'un autre par son chemin ?), RPC exposées à anon. Fais tourner pnpm --filter @cheval/db test:rls (Postgres local : PATH=/opt/homebrew/opt/postgresql@16/bin, pg_ctl -D /opt/homebrew/var/postgresql@16 -o "-k /tmp" -l /tmp/pg16.log start, PGHOST=/tmp) et ajoute les cas manquants.
- API (apps/api) : authentification de chaque route (account, coach, community, cron, email-reminders, horse-invites, planning, promo, push, referral, revenuecat, ride-safety, subscription), vérification de signature des webhooks RevenueCat, routes cron protégées, limites de débit, entrées non validées, injection, SSRF, fuite de données dans les erreurs, CORS, en-têtes (CSP déjà en place sur le site).
- Secrets : aucune clé de service dans l'app ni dans le dépôt (git grep, historique récent), seule la clé anon côté mobile et /gestion ; variables d'environnement Vercel ; eas.json ne contient que des clés publiques.
- Lien de suivi « Prévenir mes proches » (ride-safety) : le lien public ne doit montrer que le strict nécessaire, expirer, et ne pas être devinable ; alertes e-mail sans injection.
- Coach IA : données envoyées au modèle (jamais de donnée personnelle superflue), plafond de dépense mensuel, injection de prompt via les notes, refus médicaux.
- Conformité App Store (CLAUDE.md § Conformité) : paywall (3.1.2), Restaurer mes achats paywall ET Profil, liens Terms of Use / Privacy Policy exacts, suppression du compte (5.1.1(v)) qui supprime vraiment tout (y compris les fichiers Storage), Sign in with Apple (4.8), aucun prix en dur, mention « IA » du coach.

### C. Incohérences et bugs
- Texte : toute chaîne passe par t() avec traduction anglaise (un test le vérifie) ; ne reste aucune mention d'Écurie Pro visible quand PRO_ENABLED est faux (écrans, notifications, e-mails, pages légales, site, /admin visible publiquement) ; prix cohérents partout (Premium 3,99 € / 39,99 €).
- Plans : chaque limite existe dans rls.sql / apps/api/src/lib/plans.ts ET dans subscription/logic.ts.
- Relances : aucune relance hors du tableau de CLAUDE.md § Relances.
- Cas limites de CLAUDE.md § Chasse aux bugs : hors ligne, store muet (prix absents), données vides, 1 vs N chevaux, cheval partagé ou verrouillé, abonné / essai / gratuit / Premium offert, palettes sombres, anglais, « Réduire les animations », VoiceOver.
- Performance : listes paginées, pas de console.log hors __DEV__, démarrage (startupTrace).
- Analytics : événements typés, jamais de donnée personnelle.
- Vérifications finales : apps/mobile `npx tsc --noEmit`, `pnpm --filter @cheval/mobile test`, eslint des fichiers modifiés (zsh : via xargs) ; apps/api et apps/web `npx tsc --noEmit` + `npx vitest run` ; `pnpm --filter @cheval/db test:rls`. Builds de production du site et de l'API.

## Mission 2 — Poursuivre la production
Dans cet ordre, une fois le rapport rendu et les corrections faites :
1. Nouveau build iOS de production (apps/mobile : `eas build --platform ios --profile production`, puis `eas submit --platform ios --profile production --latest`) — seulement si je le demande, après le check-up.
2. Jeu anglais des visuels App Store (tools/store-screenshots : simulateur iPhone 17 Pro Max C3664CD7-77AD-4683-BF0D-CB24571EA5C0 passé en anglais ; remplir le compte de démonstration puis le vider ; capture.sh en, store-extra.yaml, store-ride.yaml).
3. Fiche App Store 1.2.0 : textes prêts dans docs/fiche-app-store-1.2.0.md (FR + EN), visuels dans tools/store-screenshots/out/. App Store Connect : version 1.2.0 (même numéro que le build), aucun produit Écurie Pro.
4. Tests réels : /gestion connecté, achat Premium en sandbox, créneaux Premium.
5. Fusion dans l'ordre release/1.1.3 → onboarding/compte-apres-cheval → v1.2 → pro/planning (préparer, ne pas pousser sans mon accord) ; reporter 136e81b sur main pour réparer sa build Vercel (next/font/google).

## Livrable attendu
1. Un rapport (docs/audit-final-2026-11.md) : problèmes trouvés classés par gravité, preuve (fichier:ligne ou test), correction faite ou décision pour moi. Dis clairement ce que tu n'as pas pu tester.
2. Les corrections commitées par petits lots (pas de push).
3. La liste de ce que je dois faire à la main (Apple, Supabase, Vercel).
