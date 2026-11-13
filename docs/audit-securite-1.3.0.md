# Audit de sécurité 1.3.0 (2026-11-13)

Méthode : lecture du code, tests (`apps/api` 168, `apps/mobile` 818, `test:rls` 15 fichiers : tous verts),
sondes HTTP en lecture seule sur la production (`tools/check-prod.sh` : « TOUT EST EN LIGNE »).
**Base de production non interrogée** (accès non autorisé) : `tools/verif-prod-lecture-seule.sql`
est à coller dans le SQL Editor (lecture seule).

## Corrigé (commits sur `release/1.3.0`)

| # | Constat | Preuve | Gravité | Correctif |
|---|---|---|---|---|
| 1 | **Une séance supprimée gardait son lien public en ligne** (`/s/<jeton>`) | `sessions/store.tsx` ne prévenait pas le serveur | Moyenne (vie privée) | `revokeLinksForSessions` appelée à la suppression d'une séance, d'un cheval ; test `publicLinkCleanup.test.ts`. Hors ligne : le lien reste enregistré, et part à la suppression du compte (cascade). |
| 2 | Aucune limite sur la saisie de codes promo | `/api/promo/redeem` | Moyenne | 10 essais / 10 min par compte (`lib/rateLimit.ts`, en mémoire : garde-fou). |
| 3 | Secrets webhook et crons comparés avec `!==` | 4 routes | Faible | `secretMatches` en temps constant, faux si secret non configuré (testé). |
| 4 | Messages d'erreur zod bruts renvoyés | 6 routes | Faible | « Requête invalide ». |
| 5 | Trace d'Écurie Pro sur le site vitrine | `content/home.ts`, `site.ts` | Conformité | Retirée (cf. commit site). |

## Vérifié, rien à corriger

- **RLS** (base de test rejouée depuis `rls.sql`) : aucune table de `public` sans RLS ; 13 tables
  « API seule » (RLS sans policy, dont `public_rides`) ; 36 fonctions `security definer`, toutes avec
  `search_path` fixé ; les seules appelables par `anon` sont des déclencheurs (non appelables en RPC).
- **API** : les 26 routes exigent un jeton Supabase (`getUserIdFromRequest`) ou un secret (crons,
  webhook RevenueCat) ; les ressources sont filtrées par `userId` (`email-reminders/[id]`,
  `public-ride` DELETE, `ride-safety/[token]`) ; `/admin` et `/admin/export` : 401 sans identifiants
  (middleware + 404 si non configuré) ; entrées validées par zod ; aucun en-tête CORS (appel mobile
  seulement) ; en-têtes HSTS, X-Frame-Options, nosniff, Referrer-Policy: no-referrer.
- **Lien public** : jeton 24 octets aléatoires (192 bits), format vérifié avant toute requête,
  `noindex` (meta), pas de cache, aucun fond de carte tiers, 20 liens / compte / 24 h, jeton inconnu
  = page « n'existe plus » (200, sans fuite), cascade à la suppression du compte (FK).
- **Secrets** : dépôt et historique ne contiennent que des clés publiques (clé anon Supabase de rôle
  `anon`, clé RevenueCat iOS publique, clé PostHog) ; aucun `.env` suivi par git ; clé service jamais
  dans `apps/web` ni `apps/mobile`.
- **Mobile** : jeton de session dans `expo-secure-store` ; permissions iOS : calendrier seulement
  (+ localisation via plugin) ; `console.warn` restants sans donnée personnelle.
- **RGPD** : la suppression de compte efface les données (cascade), fichiers, RevenueCat, PostHog,
  Apple ; la politique de confidentialité décrit traces GPS, lien public et MET Norway.

## À décider / à faire par toi

1. **Nom du cheval sur la page publique** : affiché (« Séance avec Quasar ») et déclaré dans la
   politique. Ton cahier des charges le comptait comme donnée personnelle : veux-tu un interrupteur
   « Afficher le nom du cheval » (décision produit, petit changement) ou garder tel quel ?
2. **Masquage départ/arrivée** : fait par l'app avant l'envoi ; le serveur ne peut pas le vérifier.
   Risque connu (un client modifié enverrait le tracé complet) : acceptable, c'est le choix de l'utilisateur.
3. **Vercel WAF** : règle de débit sur `/api/promo/redeem`, `/api/public-ride`, `/api/weather`
   (la limite en mémoire repart de zéro à chaque instance). Action Vercel : à toi.
4. **`pnpm audit --prod`** (lancé avec `NODE_OPTIONS=--max-old-space-size=8192`) : 2 critiques, ~30 élevées.
   - **Corrigé : `next` 15.5.25 → 15.5.29** (critique GHSA-2464-fhr4-w9xw, élevée GHSA-p3m5-59mp-jv5r) dans
     `apps/api` et `apps/web`, version fixée sans `^`. Verrou : seule la ligne `next` change (45 lignes, aucun
     outil de l'app touché) ; `tsc`, tests (API 168, web 11) et `next build` passent. Un `pnpm update` simple
     avait, lui, réécrit 1 400 lignes dont metro : évité. **Reste à faire : déployer l'API** (sur ton accord).
   - Même mise à jour : `postcss`, `nanoid`, `sharp` (dépendances de Next).
   - `zod` 3 (DoS mémoire sur très gros tableaux : correctif seulement en 4.x) : justifié, chaque schéma
     de l'API borne ses tailles (`max()`), et il faut un compte connecté.
   - Outils de build seulement, non embarqués dans l'app ni en production : `shell-quote` (critique, serveur
     de développement de React Native), `@xmldom/xmldom`, `brace-expansion`, `browserslist`, `compression`,
     `js-yaml`, `node-forge`, `image-size`, `decode-uri-component`, `deepmerge-ts` (CLI Expo/Prisma).
     À remonter avec la prochaine mise à jour d'Expo, sans urgence.
   - `pnpm.overrides` (sharp) du `package.json` racine **n'est plus lu** par pnpm : à déplacer dans
     `pnpm-workspace.yaml` (`overrides:`).
5. **Base de production** : lancer `tools/verif-prod-lecture-seule.sql` ; ou m'autoriser un accès lecture seule.
6. Variables à contrôler dans Vercel (je ne peux pas les lister) : `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`, `REVENUECAT_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD` (≥ 16),
   `RESEND_API_KEY`, clé IA ; côté site : seulement les deux variables publiques Supabase.
