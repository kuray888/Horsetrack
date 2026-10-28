# @cheval/web — site vitrine Horsetrack

Site de présentation de l'app iPhone, orienté téléchargement App Store.
Next.js 15 (App Router) + React 19, comme `apps/api` ; CSS Modules, aucune
autre dépendance d'exécution. Toutes les pages sont statiques.

## Lancer

À la racine du monorepo (le site s'ouvre sur http://localhost:3002) :

```bash
pnpm install
pnpm --filter @cheval/web dev
```

Version de production, contrôles :

```bash
pnpm --filter @cheval/web build && pnpm --filter @cheval/web start
pnpm --filter @cheval/web lint
pnpm --filter @cheval/web typecheck
```

`dev` et `start` utilisent tous deux le port 3002 : arrêter l'un (Ctrl+C)
avant de lancer l'autre.

## Variables d'environnement (lues au build)

| Variable | Rôle | Par défaut |
|---|---|---|
| `SITE_URL` | Domaine public (canonique, sitemap, Open Graph). À renseigner en production. | domaine de production Vercel, sinon `http://localhost:3002` |
| `LEGAL_BASE_URL` | Où sont servies les pages CGU / confidentialité / support (l'API). | `https://api-mu-tan-94.vercel.app` |

Une adresse non https fait échouer le build. Aucune clé ni secret : le site
n'en a besoin d'aucun.

## Déployer (Vercel)

Nouveau projet Vercel sur ce dépôt, **Root Directory : `apps/web`**
(framework Next.js détecté), variable `SITE_URL` = le domaine définitif, puis
rattacher le domaine. Le projet existant de l'API n'est pas concerné.

`apps/web/vercel.json` fixe l'installation et le build du site : sans lui,
Vercel applique au projet le `vercel.json` de la racine du dépôt, qui est
celui de l'API (il construirait l'API à la place du site).

## Où modifier quoi

- `src/content/site.ts` : liens, prix, éditeur/hébergeur, navigation.
- `src/content/home.ts` : textes de la page d'accueil, FAQ (reprise dans les
  données structurées).
- `src/content/screens.ts` : captures et leurs textes alternatifs.
- `src/components/sections/*` : une section de la page par fichier.
- `next.config.ts` : en-têtes de sécurité (CSP, HSTS…).

## Visuels

- Captures : `node scripts/extract-screens.mjs <dossier>` détoure les
  téléphones des visuels App Store (`1.png` … `7.png`, 1320×2868) vers
  `src/assets/screens/`.
- Icônes et image de partage : `node scripts/build-icons.mjs` (à partir de
  `apps/mobile/assets`).

## Données personnelles

Aucun cookie, aucune mesure d'audience, aucun formulaire : le contact passe
par email. Si un outil de mesure est ajouté un jour, mettre à jour la CSP,
les mentions légales et prévoir le consentement.
