# Audit final avant la revue Apple — 2026-11-11

Branche `pro/planning`. Six corrections commitées (rien de poussé). Tous les
contrôles sont verts après correction :

| Contrôle | Résultat |
|---|---|
| `pnpm --filter @cheval/mobile test` | 80 fichiers, 684 tests |
| `apps/mobile` : `npx tsc --noEmit`, eslint des fichiers modifiés | 0 erreur |
| `pnpm --filter @cheval/db test:rls` | 11 fichiers, 220 assertions (3 nouveaux fichiers : 25, 80, 90) |
| `apps/api` : tsc + vitest + `next build` | 141 tests, build OK, en-têtes vérifiés avec `curl` |
| `apps/web` : tsc + vitest + `next build` | 11 tests, 21 pages générées |

## 1. Problèmes trouvés et corrigés

### Élevé — Photo remplacée invisible sur les autres appareils et chez l'équipe (`ff3d1fe`)
- **Cause** : chemin de fichier fixe (`{horseId}/photo.jpg`, `{horseId}/journal/{entryId}.jpg`).
  À chemin égal, `mergeRemote.pickFileUrl` garde l'URL signée encore valable
  (90 jours) et l'image en cache : le second téléphone et la demi-pension
  voyaient l'ancienne photo pendant des semaines.
- **Correction** : le chemin dérive du nom unique du fichier choisi
  (`src/lib/sync/mediaPath.ts`, 6 tests). Un cheval n'envoie plus `photoPath`
  que si cet appareil a changé la photo : un second appareil pas encore
  rafraîchi n'écrase plus le chemin posé ailleurs (c'était déjà possible
  avant pour une photo supprimée). Les anciens fichiers ne sont pas supprimés
  au remplacement (un appareil resté en 1.1.x renvoie encore son chemin) ;
  ils partent avec le cheval, le souvenir ou le compte.

### Élevé — rls.sql ne donnait plus le droit de lire les photos (`7b98a52`)
- **Cause** : la règle `horse_photos_select_shared` a été retirée par erreur
  le 2026-09-07 (commit d2e0437) en réécrivant les règles d'écriture.
  Elle existe sans doute encore en prod (les photos s'y affichent), mais une
  base recréée depuis rls.sql ne montrait plus aucune photo, même au
  propriétaire.
- **Preuve** : nouveau `tests/rls/80-stockage.test.sql`, 3 échecs avant
  correction, 21/21 après.
- **Correction** : règle remise dans rls.sql + SQL rejouable
  `stockage-photos-lecture-2026-11-11.sql` (voir § 4).
- Le test couvre aussi : coffre-fort et photos illisibles par un autre
  compte, un ancien membre d'équipe et un visiteur anonyme ; photo de
  souvenir refusée au gratuit.

### Moyen — Déconnexion sans prévenir des saisies non envoyées (`74832ba`)
- **Cause** : se déconnecter ignorait la file d'attente. Quand un autre
  compte se connecte ensuite sur le téléphone, `clearSyncQueue` vide la file
  et les données locales : ces saisies disparaissaient sans trace.
- **Correction** : avertissement avec le nombre de modifications en attente
  (file, documents et photos de souvenirs jamais envoyés), « Annuler » ou
  « Se déconnecter quand même ». Logique pure testée
  (`src/lib/signOutGuard.ts`), textes traduits.

### Moyen — API sans en-têtes de sécurité (`1b1bda0`)
- **Cause** : `apps/api` n'avait pas de `next.config` : /admin, /suivi et les
  pages légales pouvaient être intégrées dans une page tierce, et le jeton
  du lien de suivi pouvait partir en Referer vers Plans / Google Maps selon
  le navigateur.
- **Correction** : HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy`, sans
  `X-Powered-By`. Pas de CSP (styles en ligne de /admin et de la carte : à
  régler avec un test visuel).

### Faible — rls.sql en retard sur le durcissement des fonctions (`82b1007`)
- Le durcissement du 2026-10-28 (5 fonctions retirées au visiteur anonyme)
  n'existait que dans son SQL ponctuel, déjà exécuté en prod. Recopié dans
  rls.sql ; `tests/rls/90-fonctions.test.sql` vérifie désormais qu'aucune
  fonction `security definer` n'est appelable par anon, que toutes fixent
  leur `search_path` et que toutes les tables sont sous RLS.

### Couverture ajoutée — fin d'abonnement (`tests/rls/25-fin-abonnement.test.sql`)
Un Premium expiré garde ses 2 chevaux, séances, documents, et sa demi-pension
voit toujours le cheval ; seul un 3ᵉ cheval est refusé. 12/12.

### 1 bis. Conflit entre deux appareils — corrigé
- **Avant** : le dernier *envoi* gagnait. A modifie une séance hors ligne à 9 h,
  B la modifie à 10 h, A se reconnecte à 12 h : la version de 9 h écrasait celle de 10 h.
- **Maintenant** : la modification la plus récente gagne. Avant de rejouer une
  modification hors ligne, l'app lit la date de la ligne sur le serveur ; si elle est
  plus récente (de plus de 2 min, pour tolérer les horloges), la reprise est abandonnée
  et la version du serveur s'affiche. Une bannière sur l'Accueil le dit (« 1 modification
  faite hors ligne a été remplacée par une version plus récente… », bouton OK) : rien
  ne disparaît en silence. Les dates sans fuseau du serveur sont lues en UTC.
- **Preuve** : `persistenceLifecycle.test.ts` (2 scénarios, échoue sans la correction),
  `writeConflicts.test.ts` (6 tests, passés sous deux fuseaux).
- **Limite** : la comparaison est par ligne entière, pas champ par champ ; si A a changé
  la durée et B les notes de la même séance, la plus récente des deux l'emporte.
  Aucune règle serveur ni RLS touchée : sans effet sur les droits des abonnés.

### 1 ter. Consentement pour l'IA (règle 5.1.2(i) de l'App Store) — corrigé
- **Constat** : la carte du coach sur l'Accueil envoyait le carnet du cheval à Anthropic dès
  l'ouverture de l'app pour un compte Premium, sans demander son accord. Risque de refus à la revue.
- **Correction** : écran « Autoriser le coach IA ? » (ce qui part, à qui, où, ce qui ne part pas),
  accord par compte, retirable, effacé à la suppression du compte. `coachApi.ts` refuse tout
  envoi sans accord, quel que soit l'écran. 12 tests (`consent.test.ts`, `coachApi.consent.test.ts`).
- Les utilisateurs Premium qui avaient déjà utilisé le coach le revoient une fois.

## 2. Décisions à prendre (non corrigé, volontairement)

| Gravité | Sujet | Constat | Proposition |
|---|---|---|---|
| ~~Moyen~~ | ~~Conflit entre deux appareils~~ | **Corrigé le 2026-11-11** (voir § 1 bis). | — |
| Moyen | Codes promo devinables | `/api/promo/redeem` n'a pas de limite de tentatives ; les codes sont choisis à la main (`apps/api/src/app/api/promo/redeem/route.ts:57`). Un compte peut essayer des milliers de mots. | Tout de suite : règle de limitation Vercel (Firewall → Rate limiting) sur `/api/promo/redeem`, ex. 10 requêtes/minute par IP. Plus tard : table des tentatives + codes longs aléatoires. |
| Faible | Quota du coach dépassable en rafale | Contrôle `questionsUsedThisMonth` puis appel au modèle, sans verrou : 30 questions envoyées en même temps passent toutes. Le plafond mensuel global (`COACH_MONTHLY_BUDGET_USD`, prix Haiku 5.5 vérifiés : 0,10 $ / 0,50 $ par M jetons) borne la dépense. | Verrou consultatif par compte, comme le code promo, après la 1.2.0. |
| Faible | Coffre-fort figé après la fin de l'abonnement | `documents_delete_own` exige un abonnement actif (rls.sql § documents) : un ancien abonné voit ses documents mais ne peut pas en supprimer un (seulement supprimer tout son compte). | Ouvrir la **suppression** à tous (comme pour les photos de souvenirs). Restrictif vers permissif : sans risque pour les abonnés. À trancher. |
| Faible | Comparaison du secret cron / webhook | `!==` simple (`cron/*/route.ts`, `revenuecat/webhook/route.ts:86`), pas en temps constant. Exploitation irréaliste sur réseau. | Réutiliser `safeEqual` de `lib/adminAuth.ts` à l'occasion. |
| Info | Clé RevenueCat Android de test dans le profil production d'`eas.json` | `test_…` ; sans effet tant qu'Android n'est pas publié. | La remplacer avant toute build Android. |

## 3. Vérifié, rien à signaler

- **File d'attente et fusion** (`syncQueue.ts`, `remoteIndex.ts`,
  `mergeRemote.ts`, `cloudRefresh.tsx`) : reprise après coupure, ordre,
  doublons, écritures périmées, suppressions interrompues, changement de
  compte en plein envoi — déjà couverts par les audits de septembre/octobre
  et leurs tests. Une écriture refusée (ex. séance arrivée avant son cheval)
  est renvoyée à la relecture suivante (`unsyncedLocalIds` + `isHorseOnServer`).
- **Deuxième compte sur le même téléphone** : `deviceOwner` + vidage complet
  (stores, file, index, équipes, médias) à la connexion d'un autre compte et
  à la suppression du compte.
- **Suppression du compte** : données, fichiers des deux buckets (dossier du
  compte et dossiers de ses chevaux, récursif — couvre les nouveaux chemins
  de photos), Apple, RevenueCat, PostHog, prévenance des collaborateurs.
- **RLS** : aucune table hors RLS, aucune vue, toutes les fonctions
  `security definer` à `search_path` fixé, aucune appelable par anon.
- **API** : toutes les routes authentifiées (jeton Supabase), cron et
  webhook RevenueCat derrière secret, /admin en Basic Auth fermé par défaut ;
  entrées validées par zod ; e-mails nettoyés (`safeLine`).
- **Lien « Prévenir mes proches »** : jeton de 24 octets aléatoires, page
  non indexée, illisible 24 h après la fin, balade close d'office après 12 h,
  écriture réservée au cavalier.
- **Coach IA** : Premium vérifié côté serveur, symptômes renvoyés au
  vétérinaire sans appel au modèle, carnet borné à 24 Ko, plafond mensuel.
- **Secrets** : aucune clé serveur dans le dépôt ni dans l'historique récent ;
  l'app ne contient que des clés publiques (anon Supabase, `appl_`, `phc_`).
- **Conformité** : Restaurer mes achats, Conditions d'utilisation / Privacy
  Policy (`openLegalPage`) sur le paywall et le Profil ; suppression du compte ;
  Se connecter avec Apple ; aucun prix écrit en dur en production (replis
  `__DEV__` et `FORCE_EUR_PRICES = false`) ; « Coach IA / AI coach » nommé.
- **Écurie Pro en pause** : tous les accès de l'app passent par
  `PRO_ENABLED` ; le site n'affiche que Gratuit et Premium (3,99 € / 39,99 €).
- **Limites des formules** identiques dans rls.sql, `plans.ts` et
  `subscription/logic.ts`.
- **Divers** : `console.log` seulement sous `__DEV__` ; aucune donnée
  personnelle dans les événements analytics.

## 4. Ce que je n'ai pas pu tester

- **Deux simulateurs réels (scénarios 1 à 3)** : il faut se connecter avec
  le compte de démonstration (mot de passe à me donner) et une build Release
  du simulateur. Non fait : tout le reste est couvert par les tests de
  logique et de règles, mais le correctif des photos mérite ce test réel
  (remplacer la photo sur A, tirer pour rafraîchir sur B).
- **État réel de la prod Supabase** : je ne peux pas lire ses règles. D'où
  le SQL rejouable ci-dessous.
- **Achat sandbox, /gestion connecté, variables Vercel** : à la main.
- **VoiceOver, palettes sombres, « Réduire les animations »** : pas de
  nouvel écran ; seul ajout visible, une alerte iOS native.

## 5. À faire à la main

**Supabase (SQL Editor, prod)**
1. Exécuter `packages/db/prisma/stockage-photos-lecture-2026-11-11.sql`
   (rejouable, sans effet si la règle existe déjà). Puis vérifier dans
   Storage → Policies que `horse_photos_select_shared` existe.
2. Si ce n'est pas déjà fait : `ecurie-pro-v2-9-creneaux-premium-2026-11-10.sql`
   (créneaux ouverts à Premium) avant la mise en ligne de la 1.2.0.
3. Vérification : la requête de fin de `durcissement-fonctions-2026-10-28.sql`
   doit renvoyer 0 ligne.

**Vercel**
4. Projet API : une règle Firewall → Rate limiting sur `/api/promo/redeem`.
5. Redéployer l'API pour les en-têtes de sécurité (au prochain push).

**Apple**
6. Nouvelle build : les commits de cet audit (photos, avertissement de
   déconnexion) s'ajoutent au « Coach IA » et aux icônes des puces déjà
   absents du build n° 26. Dis-moi quand lancer
   `eas build --platform ios --profile production` puis `eas submit`.
7. Après installation sur deux appareils : remplacer la photo d'un cheval
   sur l'un, rafraîchir l'autre — elle doit changer.
