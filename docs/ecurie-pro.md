# Écurie Pro — mise en service

Formule pour les propriétaires de plusieurs chevaux, les demi-pensions
multiples et les coachs. Tout Premium, plus :

| Avantage | Où c'est appliqué |
|---|---|
| Jusqu'à **5 personnes par cheval** (1 en Premium) | Base : `horse_collaborator_limit` (rls.sql), règle d'insertion + trigger anti-course ; app : fenêtre de partage |
| **Vue écurie** : soins en retard, prochaines échéances, séances de la semaine, dépenses du mois, pour chaque cheval | App : `app/ecurie.tsx`, logique `src/stable/stableOverview.ts` |
| **Coach ×3** : 100 questions/mois, suggestions pour 10 chevaux/jour, 15 résumés/mois | API : `quotasForTier` (lib/coach/config.ts) |

Prix proposés : **14,99 €/mois** ou **129,99 €/an** (−28 %). L'app affiche
toujours les prix du store : ils se règlent dans App Store Connect.

## À faire, dans cet ordre

### 1. App Store Connect
1. Abonnements → **même groupe d'abonnement que Premium** (sinon un abonné
   Premium paierait deux abonnements au lieu d'en changer).
2. Créer deux produits, **niveau au-dessus de Premium** dans le groupe (un
   passage à Pro est alors une montée en gamme : immédiate, au prorata) :
   - `ecurie_pro_monthly` — 14,99 €/mois
   - `ecurie_pro_annual` — 129,99 €/an
3. Optionnel : une offre d'essai gratuit (l'app ne l'annonce que si le store
   la confirme pour le compte).
4. Remplir nom, description et capture de revue pour chaque produit.

### 2. RevenueCat
1. Products : importer les deux produits.
2. Entitlements : créer **`ecurie_pro`** ; y rattacher les deux produits Pro,
   et les rattacher **aussi** à l'entitlement existant **`grand_prix`** (tout
   Premium reste ainsi ouvert à un compte Pro).
3. Offerings : créer l'offre **`ecurie_pro`** avec deux packages aux
   identifiants exacts **`ecurie_pro_monthly`** et **`ecurie_pro_annual`**.

### 3. Supabase (SQL Editor, prod)
1. Exécuter `packages/db/prisma/ecurie-pro-1-type-2026-11-08.sql` **seul**.
2. Puis `packages/db/prisma/ecurie-pro-2-regles-2026-11-08.sql`.
3. Écurie Pro v2, droits par rôle : `ecurie-pro-v2-1-roles-2026-11-08.sql`
   **seul**, puis `ecurie-pro-v2-2-droits-2026-11-08.sql`, puis
   `ecurie-pro-v2-3-seances-2026-11-08.sql` (séance attribuée, « C'est fait »),
   puis `ecurie-pro-v2-4-creneaux-2026-11-08.sql` (créneaux récurrents ; il
   transforme aussi les jours de demi-pension des comptes Pro en créneaux et
   affiche combien par cheval), puis
   `ecurie-pro-v2-5-notifications-2026-11-08.sql` (journal des notifications). Testés sur une base
   dans l'état actuel de la prod et rejouables (`pnpm --filter @cheval/db
   test:rls` vérifie les règles sur un Postgres local).

### 4. Déploiement
1. API (Vercel) : déployer la branche une fois les étapes 1 à 3 faites.
2. App : nouveau build EAS (aucun réglage d'environnement à ajouter).

### 5. Vérifier avec un compte sandbox
- Achat Pro → l'écran « Vue écurie » s'ouvre ; dans `/admin`, le compte passe
  en palier PRO.
- Partage : un 2ᵉ, puis jusqu'au 5ᵉ invité accepté ; le 6ᵉ est refusé.
- Un compte Premium voit « Passer à Écurie Pro » et n'est pas facturé deux fois.
- Droits, **nouvelle** invitation : une demi-pension ne voit pas le Budget, ne
  peut ni modifier ni supprimer un soin, et coche seulement ses séances.
- Droits, **partage existant** : rien ne change (Budget visible, soins
  modifiables…). Écran Équipe → la personne → « Appliquer les droits de … »
  pour la passer aux droits de son rôle.
- Séance attribuée : le propriétaire attribue une séance à la DP ; elle la
  voit (« Tu montes »), la coche ; le propriétaire voit « Monté par Léa ».
- Créneaux : fiche du cheval → Créneaux réguliers ; les jours de
  demi-pension y apparaissent déjà ; ajouter « samedi 10 h, cours » ; un
  compte Premium voit l'offre Écurie Pro au lieu du formulaire.
- Notifications (API déployée, deux iPhone) : séance attribuée → « Tu
  montes Tornade » chez la DP ; elle coche → « Léa a monté Tornade » chez
  le propriétaire ; occurrence annulée → la DP est prévenue ; rappel avant
  une séance d'un créneau, sur le téléphone de la DP.

## Mesure (PostHog)
`pro_paywall_viewed`, `pro_cta_tapped`, `purchase_started` / `purchase_completed`
(propriété `plan: "pro"`), `locked_feature_tapped` (`stable_view`,
`collaborator_limit`).
