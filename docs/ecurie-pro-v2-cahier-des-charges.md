# Écurie Pro v2 — cahier des charges

Rédigé le 2026-11-08, sur la branche `v1.2`. Prix validés : **14,99 €/mois,
129,99 €/an** (Premium reste à 3,99 € / 39,99 €).

## 1. Ce qui existe déjà (v1.2)

| Élément | Où |
|---|---|
| Palier `PRO` attribué par RevenueCat (`ecurie_pro`) | `apps/api/src/lib/plans.ts`, webhook, `revenuecatApi.ts` |
| 5 personnes par cheval (1 en Premium), appliqué en base | `rls.sql` `horse_collaborator_limit`, migrations `ecurie-pro-1/2` |
| Coach ×3 | `apps/api/src/lib/coach/config.ts` `quotasForTier` |
| Paywall Pro | `apps/mobile/app/pro.tsx` |
| Vue écurie (retards, prochaine échéance, semaine, dépenses) | `app/ecurie.tsx`, `src/stable/stableOverview.ts` |
| Mise en service | `docs/ecurie-pro.md` |

## 2. Ce qui manque dans le modèle actuel (vérifié dans le code)

1. **Aucun droit par rôle** : `can_access_horse` donne à tout invité accepté
   les mêmes droits que le propriétaire (une DP peut supprimer des soins ou
   des dépenses). Le rôle (`DEMI_PENSION`, `COACH`, `RIDER`, `GROOM`) n'est
   qu'une étiquette.
2. **Une séance n'est attribuée à personne** : `TrainingSession` n'a pas de
   cavalier. Impossible de savoir qui monte, qui a monté.
3. **La demi-pension est du texte** : `HorseDetails.partnership` = un prénom +
   des jours + un montant, sans lien avec un compte, sans créneau horaire.
4. **Pas de vue « mon planning »** pour une personne qui monte plusieurs
   chevaux (DP de deux chevaux, coach, cavalier de propriétaire).
5. **Pas de suivi de la participation aux frais** (qui a payé quoi, quel mois).
6. **Pas de tâches d'écurie** (sortie au pré, repas, traitement) attribuées et
   cochées par quelqu'un.

## 3. À qui s'adresse Pro (à confirmer, cf. § 8)

- **A. Propriétaire de plusieurs chevaux** avec DP, coach, groom : le cœur
  de la v1.
- **B. Gérant d'écurie / pension** qui suit des chevaux appartenant à ses
  clients : demande un modèle « chevaux de clients » (le gérant n'est pas
  propriétaire), cf. P3.
- **C. Coach / enseignant** qui suit les chevaux de ses élèves : aujourd'hui
  couvert si chaque propriétaire le partage (c'est le propriétaire qui paie).

## 4. Fonctionnalités, par priorité

### P1 — Planning des montes (le besoin exprimé)
- **Attribuer une séance à une personne** : propriétaire, collaborateur
  (compte), ou personne sans compte (simple nom).
- **Créneaux récurrents** par cheval et par personne (ex. DP : mardi et
  jeudi 18 h–19 h 30), qui génèrent les séances ; remplacent à terme le texte
  `partnership` (migration des jours existants).
- **Vue semaine** : grille chevaux × jours (qui monte quoi, quand), filtrable
  par cavalier ; et **« Mon planning »** pour chaque personne invitée (tous
  les chevaux qu'elle monte).
- **Contrôles** :
  - même cheval réservé deux fois sur un créneau qui se chevauche ;
  - charge de travail (trop de séances dans la semaine, deux séances
    intenses d'affilée, aucun jour de repos) — réutiliser
    `coach/constraints.ts` ;
  - cheval indisponible (blessure en cours, veille ou lendemain de concours).
  Avertir, ne pas bloquer.
- **Notifications** (Expo Push, déjà en place pour le fil) : séance
  attribuée, rappel avant, annulation ou changement, et au propriétaire :
  « <cavalier> a monté <cheval> » avec le ressenti.
- **« C'est fait »** coché par la personne qui a monté (qui, quand, ressenti).
- **Échange ou annulation de créneau** : demande, réponse du propriétaire.
- **Historique par cavalier** : séances et heures, par cheval et par mois.

### P1 — Rôles et droits (prérequis du planning)
Matrice proposée, **appliquée en base** (RLS) et reflétée dans l'app :

| Rôle | Planning | Séances | Santé / soins | Dépenses | Documents | Fiche, partage |
|---|---|---|---|---|---|---|
| Propriétaire | tout | tout | tout | tout | tout | tout |
| Gérant (nouveau) | tout | tout | tout | tout | tout | inviter, pas supprimer le cheval |
| Coach | tout | tout | lecture | — | lecture | — |
| Demi-pension | ses créneaux | ses séances | lecture | ses participations | lecture | — |
| Cavalier | ses créneaux | ses séances | lecture | — | — | — |
| Groom | lecture | lecture | tâches + soins courants | — | lecture | — |
| Véto / maréchal (nouveau) | — | — | lecture + ajout | — | lecture + ajout | — |

### P1 — Équipe
Écran « Équipe » : toutes les personnes de l'écurie, leurs rôles et leurs
chevaux ; inviter une fois pour plusieurs chevaux ; changer un rôle ;
révoquer ; appeler ou écrire.

### P2 — Tâches d'écurie
Tâches ponctuelles ou récurrentes (sortie au pré, repas, couverture,
traitement saisi par l'utilisateur — jamais une posologie proposée par
l'app), attribuées, cochées avec qui et quand ; liste du jour par personne.

### P2 — Participation aux frais (suivi, pas d'encaissement)
Montant mensuel par personne et par cheval, statut payé / à payer, rappel au
propriétaire, récapitulatif. L'app ne fait **pas** transiter d'argent.

### P2 — Rapport mensuel par cheval
PDF (réutiliser `lib/pdfBuilder.ts`) : séances et cavaliers, soins,
dépenses, poids ; partageable au propriétaire, à la DP, au coach.

### P3 — Tableau de bord web pour les gérants
Planning sur grand écran, exports CSV (sur `apps/api` ou `apps/web`, avec
l'authentification Supabase).

### P3 — Chevaux de clients (gérant ≠ propriétaire)
Le gérant Pro suit des chevaux dont le client reste propriétaire ; qui paie
quoi, transfert de propriété, fin de pension. À concevoir seulement si la
cible B est confirmée.

## 5. Modèle de données proposé (à affiner)

- `TrainingSession` : `riderUserId String?`, `riderName String?` (sans
  compte), `slotId String?`, `doneByUserId String?`, `doneAt DateTime?`.
- `RideSlot` (nouveau) : `horseId`, `riderUserId?`/`riderName?`, `weekday`,
  `startTime`, `endTime`, `validFrom`, `validUntil?`, `kind` (DP, cours,
  travail).
- `HorseCollaboratorRole` : ajouter `MANAGER`, `VET`, `FARRIER` ; fonctions
  RLS `can_edit_sessions(horse)`, `can_edit_care(horse)`, etc., par table.
- `StableTask`, `StableTaskCompletion` (P2).
- `ParticipationFee` : `horseId`, `collaboratorId`, `month`, `amount`,
  `paidAt?` (P2).

Chaque nouvelle table : RLS, synchronisation hors ligne sur le modèle de
`lib/sync/*` (file de reprise, `withWriteTracking`), migration SQL datée en
deux temps si une enum change (cf. `ecurie-pro-1/2`).

## 6. Contraintes
- Règles de `CLAUDE.md` (conformité App Store, analytics, performance,
  chasse aux bugs, formules).
- Toute limite ou droit appliqué **côté serveur** d'abord.
- Local d'abord : tout le planning doit marcher hors ligne et se resynchroniser.
- RGPD : noms et plannings des cavaliers = données personnelles (export et
  suppression de compte à mettre à jour, politique de confidentialité).
- Apple : pas de paiement entre utilisateurs dans l'app (suivi seulement).
- Tests vitest sur toute logique pure (conflits, charge, droits, créneaux).

## 7. Livraison proposée

| Lot | Contenu | Validé quand |
|---|---|---|
| 1 | Rôles et droits (RLS + app) | une DP ne peut plus supprimer un soin ; tests RLS sur une base de test |
| 2 | Séance attribuée à une personne + « C'est fait » par le cavalier | le propriétaire voit qui a monté, hors ligne compris |
| 3 | Créneaux récurrents + migration des jours de DP | les jours de DP existants deviennent des créneaux |
| 4 | Vue semaine + « Mon planning » + contrôles de conflit et de charge | conflits signalés, testés |
| 5 | Notifications du planning | attribution, rappel, « a monté » reçus sur iPhone |
| 6 | Écran Équipe | invitation multi-chevaux |
| 7 | Tâches, participation aux frais, rapport PDF | — |

## 8. Décisions (2026-11-08)

Tranchées en autonomie, à la demande du propriétaire du produit :

1. **Cible n°1 : A**, propriétaire de plusieurs chevaux (avec DP, coach,
   groom). B (pension, chevaux de clients) reste en P3 ; la plateforme web
   (§ 4, P3) sert déjà le gérant d'une écurie A.
2. **Un compte (gratuit) est nécessaire** pour voir son planning ; une
   personne sans compte n'existe que comme nom dans la grille.
3. **5 personnes par cheval** en Pro ; **chevaux illimités** en Premium comme
   en Pro.
4. **Participation aux frais : suivi + rappel au propriétaire** seulement,
   jamais de relance de paiement envoyée à la DP.
5. **Les droits par rôle s'appliquent à tout NOUVEAU partage** (Premium
   compris) ; le rôle Gérant est ouvert à tous. **Les partages existants
   gardent exactement leurs droits d'avant** (colonne `fullAccess`, posée une
   fois par la migration) : un abonné ne perd rien du jour au lendemain. Le
   propriétaire passe un ancien partage aux droits de son rôle quand il veut,
   depuis l'écran Équipe (« Appliquer les droits de … »), sans retour
   possible depuis l'app. Les nouveautés (frais, créneaux) ne sont jamais
   ouvertes aux anciens partages.
6. **Les documents restent privés** (coffre-fort du propriétaire).
7. **Pour tous** : rôles, séance attribuée, « C'est fait ». **Pro** (appliqué
   en base) : créneaux récurrents, grille semaine, Équipe, tâches, frais,
   rapport PDF, plateforme web. Si Pro s'arrête : tout reste lisible.
8. **Tests RLS** : `packages/db/tests/rls` sur un Postgres local
   (`pnpm --filter @cheval/db test:rls`).

Matrice appliquée : `horse_role_can` dans `rls.sql` (copie testée dans
`apps/mobile/src/lib/permissions.ts`). Différences avec le § 4 : les
véto / maréchal lisent aussi les séances ; le coach gère les concours ; la
fiche du cheval (identité, alimentation, demi-pension) est modifiable par le
propriétaire et le gérant ; le profil (nom, photo, traits, blessures) reste
au propriétaire seul.

## 8 bis. Questions initiales
1. Cible n°1 : A (propriétaire multi-chevaux), B (gérant de pension) ou C ?
2. Une personne qui monte doit-elle avoir un compte (gratuit) pour voir son
   planning ? Recommandé : oui (notifications, et chaque cavalier découvre
   l'app).
3. 5 personnes par cheval suffisent-elles pour une pension ? Faut-il une
   limite de chevaux en Pro ?
4. Participation aux frais : simple suivi, ou rappels envoyés à la DP ?

## 9. Autres tâches en attente
- Numéros de version (1.1.4, 1.2) dans `apps/mobile/app.json`.
- Écurie Pro sur le site (Tarifs, données structurées) et dans la fiche App
  Store (`docs/fiche-app-store.md`).
- Console `/admin` : abonnés et revenus par formule (Premium / Pro).
- Mise en service Pro : App Store Connect, RevenueCat, SQL (`docs/ecurie-pro.md`).
- Captures App Store avec le compte de démonstration
  (`tools/store-screenshots/README.md`).
