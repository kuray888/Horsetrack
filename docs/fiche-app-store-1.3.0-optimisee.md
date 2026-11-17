# Fiche App Store optimisée — 1.3.0 (préparée le 2026-11-15, à coller dans App Store Connect)

Remplace `fiche-app-store-1.3.0.md`. Méthode : skill `aso`, app « challenger » (12 notes, 5,0).
Chaque texte respecte les limites d'Apple ; aucun avis, chiffre ou promesse inventé ; pas de nom de
concurrent ; Écurie Pro n'apparaît nulle part.

## 1. Ce que la fiche en ligne montre aujourd'hui (relevé du 16/11 : version publiée 1.0.8, 13 notes à 5,0)

La version publiée s'appelle **1.0.8** dans App Store Connect (elle contient déjà : coach IA, séance GPS, créneaux, rapport PDF, widget, partage). Les « Nouveautés » de la 1.3.0 ne doivent donc lister que ce qui s'ajoute. Le build 1.3.0 doit être rattaché à une **nouvelle version nommée 1.3.0**, supérieure à 1.0.8.

| Constat | Détail | Action |
|---|---|---|
| Sous-titre ancien | « Soins, planning et concours » | Remplacé (§2) : « séances GPS » est une requête que les cavaliers tapent |
| Texte promotionnel ancien | Parle du coach IA et des créneaux (1.2) | Remplacé (§2) : il sert d'accroche en tête de description |
| Captures | 6 emplacements visibles dans la page (à confirmer dans App Store Connect) sur 10 possibles | Passer à 10, avec légendes (§5) : les légendes sont indexées depuis juin 2025 |
| Catégorie | « Style de vie » | À garder ; voir test possible en §7 |
| Achats intégrés visibles | « Grand Prix » (Premium), mais aussi « Paddock » (39,99 € / 4,99 €) et « Cheval supplémentaire » (14,99 € / 1,99 €) | **À vérifier dans App Store Connect** : Écurie Pro est en pause dans l'app ; des produits Pro ou anciens encore listés peuvent troubler un acheteur ou le relecteur. Les retirer de la vente s'ils ne sont plus proposés dans l'app |
| Mots-clés | Le champ ne se voit pas en ligne | Doublon à éviter : « gps » ne doit être que dans le sous-titre (§2) |
| Avis | 4 avis visibles, tous positifs | Ne pas les citer sur la fiche ; continuer à en obtenir (`reviewPromptLogic.ts`) |

## 2. Champs principaux

### Français (langue principale)

| Champ | Texte | Longueur |
|---|---|---|
| Nom (inchangé : il porte l'historique de classement) | Horsetrack : suivi du cheval | 28 / 30 |
| Sous-titre | Soins, séances GPS, concours | 28 / 30 |
| Mots-clés | `equitation,ecurie,veto,marechal,osteo,vaccin,vermifuge,dressage,cso,obstacle,planning,demi-pension` | 98 / 100 octets |
| Texte promotionnel | Séance en direct gratuite pour tous : chrono, GPS, allures et tracé coloré. Démarre en 1 minute avec ton cheval, puis note son prochain soin. | 141 / 170 |

Pourquoi : Apple indexe nom + sous-titre + mots-clés et ne retient chaque mot qu'une fois. Les mots déjà
dans le nom (horsetrack, suivi, cheval) ou le sous-titre (soins, séances, gps, concours) ne sont donc
pas répétés dans les mots-clés. « planning » quitte le sous-titre et passe dans les mots-clés : il reste
indexé. Sans accent, sans espace après les virgules (Apple ignore accents et pluriels).

### Anglais

| Champ | Texte | Longueur |
|---|---|---|
| Nom | Horsetrack: Horse Care Log | 26 / 30 |
| Sous-titre | Care, GPS rides & competitions | 30 / 30 |
| Mots-clés | `equestrian,riding,stable,vet,farrier,osteopath,vaccine,dressage,jumping,coach,rider,planner,tracker` | 99 / 100 octets |
| Texte promotionnel | Live rides are free for everyone: timer, GPS, gaits and a colour-coded route. Start in 1 minute with your horse, then log its next care. | 136 / 170 |

## 3. Description (français, ≤ 4 000 caractères)

> Toi et ton cheval, organisés.
>
> Horsetrack réunit tout le suivi de ton cheval au même endroit : séances, soins, concours, papiers et budget. Fini les ordonnances perdues, le vermifuge oublié ou le carnet resté à l'écurie. Tu démarres en une minute : ton cheval, puis son premier soin ou sa première séance.
>
> **SÉANCE EN DIRECT, GRATUITE POUR TOUS**
> • Chrono, distance, allures (pas, trot, galop) et tracé GPS, même écran verrouillé
> • Sécurité en balade (Premium) : sans mouvement pendant 5 minutes, tes proches sont prévenus
> • Tracé coloré par allure, relecture de la séance, vitesse et dénivelé
> • Partage ta séance en story ou en carré, avec un lien web que tu peux supprimer
> • Export GPX
>
> **SUIVI SANTÉ**
> • Véto, maréchal, ostéo, dentiste, vaccins, vermifuges : tout est noté, avec les prochaines échéances
> • Un rappel avant chaque rendez-vous (1 à la fois en gratuit, illimités avec Premium)
> • Carnet de santé exportable en PDF, à envoyer au véto en un geste
> • Un coach IA qui répond d'après le carnet de ton cheval : séances, soins, dépenses, poids (il ne remplace pas ton vétérinaire). 3 questions offertes, puis 30 par mois avec Premium
> • Contacts : véto, maréchal, coach, un toucher pour appeler, un autre pour l'itinéraire
>
> **PLANNING ET JOURNAL**
> • Planifie tes séances, coche-les une fois faites
> • Créneaux réguliers : « mardi 18 h, cours » revient chaque semaine (Premium)
> • Journal d'entraînement avec la météo du jour, alertes gel, chaleur, vent et orage
> • Progression de ton cheval : régularité, temps de travail, poids
> • Bilan de la semaine, bilan du mois et rapport du mois en PDF à partager
> • Un widget pour l'écran d'accueil
>
> **CONCOURS**
> • Prépare tes concours, épreuve par épreuve (Premium)
>
> **PAPIERS ET BUDGET**
> • Photographie ordonnances et factures, elles sont rangées et retrouvées en deux secondes (Premium)
> • Suis tes dépenses, et avec Premium, ce qui est payé et ce qui reste à régler
> • Exporte les dépenses d'une année en PDF ou en tableur (Premium)
>
> **À PLUSIEURS**
> • Invite gratuitement une personne par cheval en lecture seule : ta demi-pension, ton coach ou ton groom suit le planning et les soins
> • Avec Premium, chacun ses droits : ta DP note ses séances, ton groom les soins courants, ton budget reste à toi
>
> **GRATUIT POUR COMMENCER**
> La version gratuite suit 1 cheval avec le planning, l'agenda, les 90 derniers jours d'historique, les dépenses, la séance en direct, un objectif et un rappel à la fois. Horsetrack Premium ajoute les chevaux illimités, les rappels illimités, tout l'historique et le bilan de l'année, le bilan du mois de tes sorties, le coffre-fort de papiers, les concours détaillés, les créneaux réguliers, le rapport du mois, l'export des dépenses et le partage avec droits d'écriture.
>
> ABONNEMENT PREMIUM : essai gratuit d'1 mois, puis 3,99 €/mois ou 39,99 €/an. Le paiement est débité sur ton compte Apple à la fin de l'essai. L'abonnement se renouvelle automatiquement, sauf si tu l'annules au moins 24 h avant la fin de la période en cours. Tu le gères et l'annules à tout moment dans Réglages > [ton nom] > Abonnements.
>
> Conditions d'utilisation : https://api-mu-tan-94.vercel.app/cgu
> Politique de confidentialité : https://api-mu-tan-94.vercel.app/confidentialite

À vérifier avant de coller : les deux adresses ci-dessus doivent être **exactement** celles saisies dans
App Store Connect (champs « Conditions d'utilisation » et « Politique de confidentialité »), et les
prix doivent correspondre aux produits actifs (règle 3.1.2 de CLAUDE.md). Les formulations « Conditions
d'utilisation » et « Politique de confidentialité » sont gardées telles quelles pour correspondre au nom
des liens dans l'app.

La description n'est pas indexée pour la recherche : elle sert à convaincre. Les trois premières
lignes sont celles vues avant « plus » : elles disent le bénéfice, pas la liste des fonctions.

## 4. Description (anglais, résumé à coller en tête)

> You and your horse, organised.
>
> Horsetrack keeps everything about your horse in one place: rides, care, competitions, documents and budget. No more lost prescriptions, forgotten deworming or a logbook left at the barn. Start in one minute: your horse, then its first care or ride.
>
> LIVE RIDES, FREE FOR EVERYONE
> • Timer, distance, gaits (walk, trot, canter) and GPS route, even with the screen locked
> • Ride safety (Premium): no movement for 5 minutes and your contacts are alerted
> • Route coloured by gait, ride replay, speed and elevation
> • Share a ride as a story or square card, with a web link you can delete
> • GPX export
>
> HEALTH TRACKING
> • Vet, farrier, osteopath, dentist, vaccines, deworming: everything logged, with upcoming due dates
> • A reminder before each appointment (one at a time on the free plan, unlimited with Premium)
> • Health record exportable as a PDF, ready to send to your vet
> • An AI coach that answers from your horse's log: rides, care, expenses, weight (it does not replace your vet). 3 free questions, then 30 a month with Premium
> • Contacts: vet, farrier, coach, one tap to call and one for directions
>
> PLANNING AND JOURNAL
> • Plan your rides and tick them off when done
> • Regular slots: "Tuesday 6 pm, lesson" repeats every week (Premium)
> • Training journal with the day's weather, plus frost, heat, wind and storm alerts
> • Your horse's progress: consistency, work time, weight
> • Weekly and monthly summaries, and a monthly report as a PDF to share
> • A home-screen widget
>
> COMPETITIONS
> • Prepare each competition, class by class (Premium)
>
> DOCUMENTS AND BUDGET
> • Photograph prescriptions and receipts: filed and found in two seconds (Premium)
> • Track expenses and, with Premium, what is paid and what is left to pay
> • Export a year of expenses as a PDF or spreadsheet (Premium)
>
> SHARING
> • Invite one person per horse for free, read-only: your sharer, coach or groom follows the schedule and care
> • With Premium, everyone gets their own rights: your sharer logs their rides, your groom routine care, your budget stays yours
>
> FREE TO START
> The free plan tracks 1 horse with the schedule, calendar, journal, expenses, live rides and one reminder at a time. Horsetrack Premium adds unlimited horses and reminders, a document vault, detailed competitions, regular slots, the monthly report, expense export and sharing with edit rights.
>
> PREMIUM SUBSCRIPTION: 1-month free trial, then €3.99/month or €39.99/year (prices shown in your local currency on the App Store). Payment is charged to your Apple account at the end of the trial. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel any time in Settings > [your name] > Subscriptions.
>
> Terms of Use: https://api-mu-tan-94.vercel.app/cgu
> Privacy Policy: https://api-mu-tan-94.vercel.app/confidentialite

## 5. Captures d'écran (10 sur 10, dans cet ordre) et légendes

Les trois premières apparaissent dans les résultats de recherche : 9 personnes sur 10 ne vont pas
plus loin. Une phrase courte par capture, sans chiffre inventé. Légendes indexées depuis juin 2025 :
elles portent les mots « soins », « séance », « GPS », « concours ».

| # | Écran | Légende FR | Légende EN |
|---|---|---|---|
| 1 | Accueil avec le cheval et « Premiers pas » | Toi et ton cheval, organisés | You and your horse, organised |
| 2 | Séance en direct, tracé coloré par allure | Séance GPS en direct, gratuite | Live GPS rides, free |
| 3 | Santé et prochaines échéances | Ne rate plus aucun soin | Never miss a care date again |
| 4 | Relire la séance (allures, dénivelé) | Relis chaque séance, allure par allure | Replay every ride, gait by gait |
| 5 | Planning (liste ou mois) | Planifie chaque séance | Plan every ride |
| 6 | Coach IA | Un coach IA qui connaît ton cheval | An AI coach that knows your horse |
| 7 | Concours, épreuve par épreuve | Prépare tes concours | Prepare every competition |
| 8 | Budget | Sache ce que ton cheval te coûte | Know what your horse costs |
| 9 | Partage / lecture seule | Partage avec ta demi-pension | Share with your sharer or coach |
| 10 | Progression | La progression de ton cheval | Your horse's progress |

À refaire d'abord (les écrans ont changé en 1.3.0 et lors de l'audit du 15/11) : Accueil, fiche du
cheval (« + » en haut), Profil, Planning (bilan sur une ligne), Séance en direct, Relire la séance,
Progression. Génération : `tools/store-screenshots` (`npm run render`) avec le compte démo en Premium ;
ne jamais y montrer un vrai client, et mettre à jour la médaille « 5,0 · 12 notes » (`RATING` dans
`screens.mjs`) si vous la gardez.

## 6. Nouveautés de la version (à coller)

### Français

• Séance en direct gratuite pour tous : chrono, GPS, allures, export GPX
• Démarre en 1 minute : ton cheval, puis son premier soin ou sa première séance
• Tracé GPS coloré par allure (pas, trot, galop), et relecture de la séance sur une carte : Plan, Satellite ou 3D
• Partage une séance en story ou en carré, tracé coloré et légende des allures ; fond de carte désactivé par défaut, départ et arrivée masquables
• Langue au choix : Profil → Langue (Automatique, Français, English)
• Nouvelles séances : Plat, Barres au sol / cavaletti
• Météo plus fiable, alertes gel, chaleur, vent et orage
• Progression de ton cheval : régularité, temps de travail, poids
• Invite gratuitement une personne en lecture seule ; 3 questions offertes au coach IA
• Annule une suppression pendant 5 secondes, rendez-vous et soins compris
• Plus confortable : le clavier ne cache plus les champs, une saisie en cours n'est plus perdue sans prévenir, un toucher sur un événement ouvre cet événement

### English

• Live rides are free for everyone: timer, GPS, gaits, GPX export
• Start in 1 minute: your horse, then its first care or ride
• GPS route coloured by gait (walk, trot, canter), and ride replay on a map: Standard, Satellite or 3D
• Share a ride as a story or square card with a coloured route and gait legend; map background off by default, start and end can be hidden
• Choose your language: Profile → Language (Automatic, French, English)
• New sessions: Flatwork, Ground poles / cavaletti
• More reliable weather, with frost, heat, wind and storm alerts
• Your horse's progress: consistency, work time, weight
• Invite one person for free (read-only); 3 free AI coach questions
• Undo a deletion for 5 seconds, appointments and care included
• More comfortable: the keyboard no longer hides fields, unsaved input isn't lost without warning, and tapping an event opens that event

## 7. Ce qui pèse le plus, et à tester (un seul changement à la fois, mesure à 14 jours)

1. **Captures** (§5) : test de page produit (Product Page Optimization) : jeu par défaut contre un jeu qui ouvre sur la séance en direct gratuite. Mesurer le taux de conversion (téléchargements / vues).
2. **Sous-titre** : « Soins, séances GPS, concours » contre l'ancien. Il se modifie avec chaque version ; le texte promotionnel, lui, à tout moment sans nouvelle version.
3. **Vidéo d'aperçu** de 15 à 30 s : la séance en direct, du démarrage au tracé coloré. Elle se lance sans son : lisible sans le son.
4. **Pages produit personnalisées** (déjà prévues dans `fiche-app-store.md`) : propriétaire avec DP, compétition, santé ; une adresse par public pour vos publications.
5. **Événements in-app** : mars (vaccins de printemps), avril à juin (saison des concours), septembre (rentrée), décembre (bilan de l'année).
6. **Catégorie** : « Style de vie » est cohérente. Sports est la seule alternative plausible ; un changement fait perdre le classement actuel, à ne tenter que si les impressions restent faibles après 2 mises à jour.
7. **Note et avis** : la note de 5,0 sur 12 est un atout fragile (un seul avis bas la change). Le plus rentable reste d'en obtenir davantage, en respectant le plafond d'Apple (3 demandes par an). Ne jamais en citer sur la fiche.

Mesures à relever dans App Store Connect avant et après : impressions, vues de la page, conversion,
requêtes de recherche, téléchargements par page produit.

## 8. Avant de soumettre : réponses de confidentialité et notes de revue

Inchangées par rapport à `soumission-app-store-1.3.0.md` : « Localisation précise » (traces GPS) et
« contenu de l'utilisateur » (séance partagée par lien) à confirmer ; notes pour l'App Review en anglais
à reprendre telles quelles. Compte de revue : un compte gratuit avec données ; Premium se teste par un
achat en bac à sable depuis le paywall.
