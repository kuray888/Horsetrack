# Liste de contrôle avant chaque soumission App Store

Chaque ligne vient d'un oubli réel (1.2.0). Cocher dans l'ordre.

## Ce qui est EN LIGNE (une commande)
- [ ] `tools/check-prod.sh` : toutes les lignes « ok » (routes de l'API, pages légales,
      en-têtes de sécurité, aucune mention d'Écurie Pro, version).
      *Oubli de la 1.2.0 : l'API de production n'avait ni `/api/planning/notify` ni les
      en-têtes ; l'app appelait une route absente.*
- [ ] SQL Supabase exécutés (cf. `docs/ecurie-pro.md`, `packages/db/prisma/*-2026-*.sql`)
      et `pnpm --filter @cheval/db test:rls` vert.

- [ ] **1.3.0, dans cet ordre** :
      1. Supabase : `invitation-gratuite-2026-11-13.sql` (rôle lecture seule ; sans effet sur les
         partages existants). La séance en direct reste gratuite pour tous : aucun SQL pour elle.
      2. API de `release/1.3.0` en production (fusion dans `main`, `tools/check-prod.sh`) :
         questions offertes du coach, route météo, politique de confidentialité.
      3. Publier la 1.3.0 dans App Store Connect.
      4. Site : publier la mise à jour préparée (tarifs : coach, créneau météo, partage gratuit).

## Ce qui est DANS le build
- [ ] `apps/mobile` : `npx tsc --noEmit`, `pnpm test`, eslint des fichiers modifiés.
- [ ] `apps/api` et `apps/web` : `npx tsc --noEmit`, `npx vitest run`, `npx next build`.
- [ ] Version de `app.json` = nom de la version dans App Store Connect (le numéro de build
      s'incrémente seul : `autoIncrement`).
- [ ] Le build est tiré d'un arbre propre **et poussé** (ou au moins tagué) : un build dont le
      code n'existe que sur un Mac ne se reconstruit pas.

## Conformité Apple (CLAUDE.md § Conformité)
- [ ] Paywall : prix, durée, essai, renouvellement, où annuler ; « Restaurer mes achats » et
      liens Terms of Use / Privacy Policy sur le paywall ET dans le Profil.
- [ ] **Anglais** : relire le paywall en anglais (un mot français ou « 1 months » se voit).
- [ ] Suppression du compte ; Se connecter avec Apple ; aucun prix écrit en dur.
- [ ] IA : écran de consentement au premier usage du coach, retirable ; la politique de
      confidentialité le dit.
- [ ] Notes de revue : un compte **gratuit** avec des données (pas un « compte Premium » sans
      achat RevenueCat) ; Premium se teste par achat sandbox depuis le paywall.

## Fiche App Store
- [ ] Textes FR + EN (`fiche-app-store-1.2.0.md`), adresses, réponses de confidentialité
      (`soumission-app-store-1.2.0.md`), visuels FR et EN.
- [ ] Aucun produit Écurie Pro rattaché à la version.
- [ ] Le bon build choisi (le plus récent), pas un ancien resté dans TestFlight.

## Tests réels (jamais couverts par les tests automatiques)
- [ ] Deux appareils : photo changée sur l'un, vue sur l'autre.
- [ ] Achat sandbox jusqu'à l'écran de bienvenue Premium ; restauration.
- [ ] Coach : écran « Autoriser » au premier usage, réponse, retrait de l'accord.
- [ ] Une modification faite hors ligne sur un appareil, renvoyée après une modification plus
      récente sur l'autre : la bannière de conflit s'affiche.
