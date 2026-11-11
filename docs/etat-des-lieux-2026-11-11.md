# État des lieux — 2026-11-11 (Mission 0)

## 1. Version 1.2.0

| Point | Constat | Preuve |
|---|---|---|
| Dernier build | **n° 30**, 1.2.0, terminé le 11/11 à 20 h 34 | `eas build:list` |
| Code du build | commit `a973c8c` (tag local `build-1.2.0-30`) | `eas build:list`, `git tag` |
| Code poussé ? | **Non** : `pro/planning` a 34 commits d'avance sur `origin`, le tag n'est pas sur GitHub | `git status -sb`, `git ls-remote --tags` |
| Statut chez Apple | **Inconnu** (en revue, refusé ou publié ?) : je n'ai pas accès à App Store Connect | — |

**Risque** : le build n° 30 n'existe que sur ce Mac (leçon de la 1.2.0 non appliquée). À faire
avec ton accord : `git push origin pro/planning build-1.2.0-30`.

## 2. Production en ligne (`tools/check-prod.sh`)

```
ÉCHEC POST /api/planning/notify → 404 (attendu 401)
ÉCHEC x-frame-options / referrer-policy / x-content-type-options absents
ok    les 12 autres routes, les 4 pages légales, HSTS, aucune mention d'Écurie Pro
```

L'API de production est encore celle de `main` (29 octobre, 1.1.3). Entre `main` et
`pro/planning`, `apps/api` diffère de 35 fichiers ; ce que la 1.2.0 attend du serveur :

| Changement serveur | Effet si la 1.2.0 sort avant le déploiement |
|---|---|
| `/api/planning/notify` | Route absente. Seulement utilisée par Écurie Pro (en pause) : sans effet visible. |
| Coach : langue gardée en cache, quotas par formule | L'app en anglais peut recevoir l'idée du jour en français (le défaut corrigé). |
| Webhook RevenueCat : palier lu sur l'entitlement | Sans effet tant qu'Écurie Pro n'est pas vendue. |
| Suppression du compte : signalements anonymisés | **Un compte supprimé laisse son identifiant dans `comment_reports`** (RGPD). |
| En-têtes de sécurité | /admin, /suivi intégrables dans une page tierce. |

**À faire avant de publier la 1.2.0** (dans App Store Connect, choisir « publication
manuelle » pour garder la main) : exécuter les SQL listés dans `docs/audit-final-2026-11.md` § 5,
puis déployer l'API (fusion dans `main` + push, ou promotion d'un déploiement de
`pro/planning` dans Vercel), puis relancer `tools/check-prod.sh` jusqu'à « TOUT EST EN LIGNE ».

## 3. Branches

Toutes partent de `main` et le contenu des trois premières est **déjà dans `pro/planning`** :

| Branche | Ce qui manque à `pro/planning` | Conflit simulé (`git merge-tree`) |
|---|---|---|
| `release/1.1.3` | rien (le correctif « Bibliothèque d'exercices », `d5e10f9`, y est réappliqué : `splitByDiscipline`, en-tête fixe de `Screen`) | `en.ts` (forme) |
| `onboarding/compte-apres-cheval` | seulement le numéro 1.1.4 dans `app.json` (le nouvel onboarding est déjà dans `pro/planning`) | `app.json`, `en.ts` |
| `v1.2` | rien (ancêtre direct) | — |
| `136e81b` (police du site hébergée) | déjà dans `pro/planning` | — |

Fusion préparée (rien n'est exécuté, attend ton accord) :

```sh
git switch main
git merge --ff-only pro/planning          # main = build n° 30 + docs, sans commit de fusion
git merge -s ours release/1.1.3 onboarding/compte-apres-cheval -m "Historique : branches 1.1.3 et 1.1.4 déjà contenues dans la 1.2.0"
git push origin main pro/planning build-1.2.0-30   # déclenche le déploiement de production de l'API et du site
```

`-s ours` garde le contenu de la 1.2.0 et ne fait que relier l'historique : aucun fichier ne
change. La nouvelle version se prépare sur **`release/1.3.0`** (créée depuis `pro/planning`).
`app.json` reste à 1.2.0 tant que la revue n'est pas finie (un correctif de refus partirait en 1.2.0).

## 4. Tunnel d'analytics (en attendant tes chiffres)

Tous les événements de CLAUDE.md § Analytics sont typés (`AnalyticsEvent`) et envoyés :

| Événement | Où |
|---|---|
| `onboarding_step_viewed` | `components/onboarding.tsx`, `welcome`, `summary`, `account` |
| `onboarding_completed` | `(onboarding)/paywall.tsx` |
| `paywall_viewed`, `paywall_plan_selected`, `paywall_cta_tapped`, `paywall_dismissed`, `free_tier_chosen` | `PaywallView.tsx` |
| `purchase_completed`, `purchase_failed` | `subscription/store.tsx` |
| `app_opened` (rétention J1/J7/J30) | `lib/analytics.ts` : au lancement (`cold: true`) et à chaque retour au premier plan |
| `session_created`, `reminder_created`, `coach_question_asked` | stores et écrans concernés |

Clé PostHog présente dans les trois profils d'`eas.json` (hôte UE). Rien à corriger.

## 5. Encore à faire à la main (repris des sessions précédentes)

- Visuels anglais de l'App Store (bloqués : le compte démo est gratuit sur simulateur neuf,
  cf. mémoire « Compte démo »).
- Tests réels : achat sandbox, deux appareils (photo), /gestion connecté.
- Vercel : limitation de débit sur `/api/promo/redeem`.
