# Audit produit Horsetrack — octobre 2026

Périmètre : app iPhone (Expo, `apps/mobile`), API et pages publiques (Next.js, `apps/api`), base (Prisma/Supabase, `packages/db`), site vitrine (`apps/web`).

## 1. Ce qui est déjà solide

À garder tel quel, ce sont des atouts qu'on retrouve rarement à ce stade :

- **Paywall honnête et conforme** : prix lus dans le store, essai annoncé seulement s'il est confirmé, frise « aujourd'hui / rappel / début du paiement », sortie gratuite visible, titre adapté au contexte (8 points d'entrée).
- **Fiabilité des données** : local d'abord, file de synchro qui survit à la fermeture de l'app, verrous anti-course, webhook RevenueCat idempotent et protégé contre les événements reçus dans le désordre.
- **Sécurité** : RLS sur toutes les tables, droits d'abonnement jamais écrits par l'app, codes promo validés côté serveur avec verrou transactionnel.
- **Tests** : 361 tests mobile, 50 tests API (dont 26 ajoutés dans ce lot).

## 2. Livré dans ce lot

### Codes promo v2

| Besoin | Réponse |
|---|---|
| Remise en % ou en montant fixe | Type **Offre store** : Horsetrack vérifie ses conditions puis ouvre la feuille officielle de l'App Store avec le code prérempli. Apple affiche le prix remisé et facture. Ni l'app ni le serveur ne calculent ou ne simulent jamais un prix ou un paiement. |
| Jours de Premium offerts | Type existant, inchangé pour les codes déjà en base. |
| Dates | Début et fin facultatifs, en heure de Paris. |
| Limites | Plafond global d'utilisations ; une utilisation par compte. Une offre abandonnée sur la feuille Apple peut être rouverte sans consommer de place. |
| Conditions | Tous, jamais abonnés, anciens abonnés (reconquête), ancienneté du compte. |
| Validation serveur | Règles pures dans `apps/api/src/lib/promoRules.ts`, testées. L'app n'ouvre que des adresses `apps.apple.com/redeem` ou `play.google.com/redeem`. |
| Suivi | Chaque utilisation a un statut. Un achat fait avec un code d'offre est rattaché à son code via `offer_code` du webhook RevenueCat. |
| Codes générés par Apple | Un code inconnu de Horsetrack sur iPhone propose « L'utiliser sur l'App Store ». |

Après une offre confirmée sur l'App Store, le retour dans l'app mène à l'écran de bienvenue Premium.

### Console d'administration (`/admin` sur l'API)

- Vue d'ensemble : comptes, nouveaux sur 7 et 30 jours, abonnés payants, part annuel/mensuel, essais en cours, chevaux suivis.
- Codes : tableau avec utilisations, jauge, conversions, statut (actif, programmé, épuisé, expiré) ; création et désactivation.
- Dernières utilisations, recherche d'un compte par email (lecture seule).
- Protection : identifiants HTTP, vérifiés aussi dans chaque action. Sans configuration, la page répond 404. `noindex`, `no-store`. Mode sombre et affichage mobile.

### Paywall et accessibilité

- **Corrigé** : pendant le chargement, les cartes affichaient le prix de repli codé en dur (39,99 €), même pour un client facturé dans une autre devise. Un emplacement animé (skeleton) le remplace désormais.
- Champ code promo : validation au clavier, état « Vérification… », icône de résultat annoncée par VoiceOver.
- Le réglage « Réduire les animations » est respecté (apparitions, skeleton).

### Lot 2 — fluidité et design

- **Apparitions plafonnées** : les listes échelonnaient leurs éléments sans limite (`120 + i × 60` ms), soit plus de 3 s pour le 50ᵉ souvenir du Journal et des retards cumulés par mois dans le Planning. Le délai est désormais plafonné à 420 ms, avec une courbe de décélération. Six écrans sont corrigés d'un coup (`FadeInView`).
- **Journal progressif** : 25 souvenirs, puis « Afficher plus ». Les photos ne sont plus toutes décodées à l'ouverture.
- **Ouvertures animées** (iOS) : cartes dépliables, formulaires en ligne, « Plus de détails », comparatif et code promo du paywall, bandeau « Séance faite ».
- **Retours haptiques** (`expo-haptics`), réservés aux moments clés : séance cochée, choix de formule, code promo accepté ou refusé, bienvenue Premium, ouverture d'un formulaire d'ajout. Le module se charge sans risque sur un ancien client de développement.
- **Photos** : fondu d'apparition au lieu d'un affichage brutal.
- **Barre d'onglets** : le Planning a une icône de calendrier ; il y avait deux chevaux côte à côte.
- **Météo de l'Accueil** : « Auj. » au lieu de « Aujourd… » tronqué ; bandeau bord à bord, sans le rectangle laissé par l'ombre coupée.
- **Accueil** : la photo du cheval ouvre sa fiche.
- Tout respecte « Réduire les animations ».

### Sprint 1 — « ça fait natif »

- **Barre d'onglets native sur iPhone** (`NativeTabs` d'expo-router) : flou système, verre « Liquid Glass » qui se réduit au défilement sur iOS 26, icônes SF Symbols. Toucher l'onglet actif remonte la liste en haut. Android garde la barre actuelle. Les onglets restent montés à leur première visite (`lazyTab`), le démarrage n'est pas alourdi.
- **Transition zoom** (iOS 18+) : la photo du cheval, dans la liste des chevaux ou l'en-tête de l'Accueil, grandit jusqu'à la bannière de sa fiche.
- **Appui long sur un cheval** (liste des chevaux) : menu natif « Planifier une séance », « Modifier », « Partager l'accès ».
- **Balayage des cartes** (`react-native-gesture-handler`) : dans le Planning, balayer une séance vers la droite la marque faite (ou à faire), vers la gauche révèle « Supprimer ». Même « Supprimer » sur les rendez-vous et les souvenirs du Journal. Une suppression demande toujours confirmation.
- **Séance faite en un toucher** : une case à cocher remplace la flèche des cartes de séance du Planning. Il fallait déplier la carte puis toucher « Marquer faite ».
- **Corrigé** : au premier passage sur le Planning depuis « Planifier une séance » (Accueil, fiche cheval), le formulaire ne s'ouvrait pas.
- **Corrigé** : supprimer un rendez-vous depuis le Planning partait au premier toucher, sans confirmation, avec ses rappels. La confirmation est désormais la même que pour une séance.
- Non retenu : les feuilles à mi-hauteur pour les petites fenêtres. Elles contiennent des formulaires avec clavier et sélecteurs superposés, à valider sur appareil avant d'en changer la présentation.

### Sprint 2 — clarté

- **Accueil** : « Aujourd'hui » (les séances du jour, à cocher) passe juste sous l'en-tête et les bannières de sauvegarde ; il était en 9ᵉ position. « Planifier une séance » est intégré à cette carte au lieu d'un gros bouton à part. La météo et le conseil du jour restent juste en dessous, comme demandé le 23 septembre. La case à cocher est la même que dans le Planning.
- **Un « + » à la même place partout** : en haut à droite du titre du Planning, du Journal et de l'onglet Chevaux. Il remplace les grands cadres « Ajouter » en pointillés, et disparaît tant qu'un formulaire est ouvert.
- **Planning** : les statistiques s'ouvrent depuis un bouton à côté de Liste/Mois (la carte repliée prenait une ligne entière), et les filtres tiennent sur une ligne qui défile.
- **Journal** : la photo du souvenir se voit carte fermée, avec un aperçu du texte ; la météo et le ressenti ne sont plus répétés. « Pour X » s'affiche dans le formulaire, plus en permanence sous le titre.
- **Fiche cheval** : le bouton « Modifier », doublon du crayon de la bannière, devient « Planifier », proposé aussi pour un cheval partagé.
- **Séance cochée** : le bandeau dit où en est la semaine (« Séance faite · 2/3 cette semaine ») et fête la semaine bouclée, avec une coche animée.

### Lot 3 — rappels utiles

- **Toucher un rappel ouvre le bon écran** : la page Santé du cheval pour un soin ou une échéance, le Planning (filtré sur les concours) pour un concours, l'Accueil pour le bilan du dimanche. Avant, la notification ouvrait l'app là où on l'avait laissée. Fonctionne app fermée ou ouverte ; seuls des chemins internes sont suivis (`lib/notificationLinks.ts`, testé). Les rappels programmés avant cette version ouvrent l'app comme avant.
- **Prochaine échéance en un toucher** : sous le champ, des raccourcis selon le soin (maréchal 6, 8 ou 10 semaines ; vaccin 6 mois ou 1 an ; vermifuge 3, 4 ou 6 mois…), calculés depuis la date du rendez-vous. Rien n'est présélectionné : ce sont des raccourcis de saisie, pas des recommandations.
- Non retenus après vérification : le **widget** (déjà écrit, mais `@bacons/apple-targets` 5.0.0, sortie après Expo 57, dépend toujours de la configuration de build d'Expo 55 ; à essayer sur un build dédié, il touche aux entitlements App Group) et la **pastille d'icône** (elle ne se met à jour qu'à l'ouverture de l'app et afficherait des retards périmés).

### Lot 4 — rétention

- **Rappels de séance** : 1 h avant chaque séance prévue (9 h le jour même pour une séance sans heure), sur les 7 prochains jours et 10 au plus, pour laisser la place aux rappels de rendez-vous (iOS en garde 64). Deux boutons sous la notification : « C'est fait ✓ » coche la séance, « Reporter à demain » la déplace. Gratuit, activé par défaut, réglable dans Profil ; ne demande jamais la permission de lui-même. Tenus à jour à chaque changement de séance et à chaque retour dans l'app, recoupés avec ce que le système a réellement en attente. Aucune donnée serveur ajoutée.
- **Offre de retour** : un code « Remise sur l'abonnement » créé dans `/admin` avec la campagne `retour` est proposé de lui-même, sur l'Accueil, aux comptes redevenus gratuits qui y ont droit (route `GET /api/promo/winback`, règles testées). Le bouton passe par le parcours de code promo habituel : la feuille Apple affiche le prix et facture. Masquable 14 jours.
- **Mesure** :
  - console admin : tunnel d'activation des comptes des 30 derniers jours, lu dans la base (inscrit → onboarding → cheval → séance → séance cochée → essai → payant), et nombre de cavaliers actifs sur 7 jours ;
  - app : nouveaux événements `app_opened`, `session_created`, `session_completed`, `notification_opened`, `session_reminder_action`, `winback_offer_*`, `milestone_unlocked`, `milestone_shared` (badges ; cf. § « Tableau de bord PostHog »).
- **VoiceOver** :
  - les cartes de séance, de souvenir et de rendez-vous étaient des boutons contenant d'autres boutons : VoiceOver n'en voyait qu'un, et la case à cocher, « Modifier » ou « Supprimer » étaient inatteignables. Repliées, elles s'annoncent en une phrase avec leurs actions dans le rotor (Déplier, Marquer faite, Modifier, Supprimer) ; dépliées, chaque bouton redevient accessible ;
  - même défaut sur la feuille « Ajouter », dont le fond englobait les options : corrigé ;
  - rôle « bouton » ajouté à une soixantaine d'éléments touchables (Accueil, Chevaux, Planning, Journal, fiche cheval, cartes).
- **Badges du couple** (fiche cheval) : 14 badges tirés de faits réels — séances faites, heures de travail, meilleure série de semaines, concours, soins, souvenirs, un an de suivi. Le prochain s'affiche avec sa progression, ceux obtenus se partagent d'un toucher, et cocher la séance qui en débloque un l'annonce aussitôt. Pas de points pour avoir ouvert l'app, et aucun badge ne se perd (cf. le principe de `lib/progress.ts`).

### Lot 5 — simplicité et mode sombre

- **Un seul sélecteur de cheval** : la rangée de photos de l'Accueil, avec une vignette « Tous » en tête, sert aussi au Planning et au Journal. Le Planning affichait deux sélecteurs (photos, puis boutons de filtre) et une phrase pour distinguer « cheval actif » et « cheval du filtre ». Choisir un cheval en fait le cheval actif partout ; « Tous » mêle l'écurie. Les règles existantes sont gardées (« Tous » du Planning réservé aux chevaux possédés non verrouillés ; dans le Journal, un cheval verrouillé se relit sans paywall). Le cheval qui recevra un ajout s'affiche dans le formulaire.
- **Mode sombre** : une variante sombre pour chacune des 6 palettes, choix « Automatique / Clair / Sombre » dans Profil → Apparence. Le choix est appliqué aussi au clavier, aux alertes et à la barre d'état. Le logo devient clair sur fond sombre. Les icônes de catégories suivent désormais la palette active, en clair comme en sombre (elles restaient bleu marine quelle que soit la palette). Un test vérifie le contraste des 12 palettes.
- **Planning découpé** sans changement de comportement : 1 560 → 1 165 lignes. Calculs de calendrier, état du formulaire, vue Mois, formulaire de séance et statistiques vivent dans `src/planning/` ; les calculs sont maintenant testés.
- **Widget, essai à part** : `@bacons/apple-targets` 5.0.0 fonctionne avec Expo 57 — le projet iOS se génère et la cible widget compile pour le simulateur. L'essai a été entièrement retiré ensuite. Pour l'activer dans une prochaine version : renseigner `ios.appleTeamId`, déclarer l'App Group `group.com.horsetrack.app`, et brancher `pushWidgetData` (`lib/widgetKit.ts`) sur l'ExtensionStorage du plugin.

### Lot 6 — à niveau des meilleures apps (27 octobre)

Comparaison avec Equilab, Equisense et Ridely : ce que le marché attend et que Horsetrack n'avait pas.

- **Séance en direct** (gratuit) : « + » → Séance en direct, ou ▶ sur la séance du jour de l'Accueil et dans une carte de séance. Chrono, pause, distance, vitesse, temps passé au pas / trot / galop (estimé d'après la vitesse), tracé dessiné sans fond de carte. Continue écran verrouillé (iOS : mode arrière-plan « location », pastille bleue ; Android : service de premier plan) avec la seule autorisation « pendant l'utilisation ». GPS désactivable (manège couvert). Reprise automatique si l'app est fermée en cours de séance ; un bandeau « Séance en cours » sur l'Accueil ramène à l'écran. À la fin, la séance prévue est cochée avec sa durée réelle, ou une séance faite est créée ; le parcours s'affiche sur sa carte du Planning. Calculs dans `src/rides/rideMath.ts` (testés), enregistreur `src/rides/recorder.ts`. Parcours synchronisé dans une table à part (`training_session_rides`) : la synchro des séances n'en dépend jamais.
- **Sécurité en balade** (Premium) : « Prévenir mes proches » au départ (prénom + 1 à 3 proches avec email). Les proches reçoivent un lien de suivi (`/suivi/<jeton>` sur l'API : dernière position, statut, Plans/Google Maps, rafraîchi toutes les 30 s, illisible 24 h après la fin). Immobile 5 min → notification « Tout va bien ? » ; sans réponse en 2 min → email d'alerte avec la dernière position (une seule fois, réarmée quand le cavalier repart). Bouton « Alerter » manuel. Téléphone muet 15 min → email (cron). Fin de balade → les proches alertés sont rassurés. Seule la dernière position est gardée, purgée 7 jours après. Règles testées : `apps/api/src/lib/rideSafety.ts`, `src/rides/safetyLogic.ts`. Nouveau point d'entrée du paywall (`ride_safety`).
- **Export de toutes les données** (gratuit, droit à la portabilité) : Profil → Exporter mes données → un .zip de CSV (chevaux, séances, rendez-vous, épreuves, journal, dépenses, poids, documents, objectifs) lisibles par Excel, au format de la langue de l'app. Protégé contre l'injection de formules. `src/export/` (testé).
- **Ajout au Calendrier** : « Calendrier » sur une carte de rendez-vous ou de concours ouvre la fiche « Nouvel événement » du téléphone, préremplie (journée entière si pas d'heure, concours sur plusieurs jours). Aucune autorisation sur iOS 17+. `src/agenda/calendarEvent.ts` (testé).
- **Widget iOS** activé (`@bacons/apple-targets`, App Group `group.com.horsetrack.app`, Team ID `FLGK6A7S8X` lu dans le certificat de développement, à confirmer) : séance du jour, semaine, prochain événement, points à surveiller. Corrigé avant activation : il affichait un faux cheval « Tornado » tant que l'app n'avait rien écrit, et gardait la séance de la veille après minuit.
- **Anglais** : toute l'app (1 750 textes, contenus de séance, conseils et glossaire compris), choisie selon la langue du téléphone ; français sinon. Le français reste écrit dans le code, enveloppé dans `t()` (`src/i18n/`) ; un test refuse tout texte sans traduction. Dates, nombres, CSV et textes d'autorisation iOS suivent la langue. Les valeurs enregistrées (tempérament, problèmes de santé…) restent en français en base et sont traduites à l'affichage, pour qu'un cheval partagé garde les mêmes données dans les deux langues.
- Politique de confidentialité mise à jour (position pendant une séance en direct, proches de la sécurité en balade, portabilité) : page `/confidentialite` et `legal/politique-confidentialite.md`.

### Lot 7 — ce qui démarque Horsetrack (bloc B, 27 octobre)

- **Plus de types de séance** : travail à pied, liberté, cross / complet, endurance, TREC, pansage / soins (le pansage compte comme un jour sans travail). Sans toucher à l'enum Postgres : le type de base le plus proche reste dans `activityType` — une ancienne version de l'app affiche « Longe » au lieu de planter — et le type précis va dans la nouvelle colonne `activityKind` (`src/agenda/activityKinds.ts`, testé).
- **Identité du cheval** (gratuit) : SIRE, UELN, transpondeur, assureur et contrat, écurie ; formats contrôlés à titre indicatif. Fiche cheval → Identité.
- **Contacts** (gratuit) : carnet véto / maréchal / ostéo / dentiste / coach / pension, appel et email en un toucher (Profil → Mes contacts). Une carte de rendez-vous propose « Appeler » quand le professionnel est dans le carnet ; le formulaire propose les contacts du bon métier.
- **Alimentation** (gratuit) : ration repas par repas, foin, compléments, consignes, envoi par message ; visible par la demi-pension et le coach. Fiche cheval → Alimentation.
- **Bilan de l'année** (gratuit) : « Mon année avec {cheval} » — séances, heures, km au GPS, meilleure série, concours et résultats, soins, souvenirs — en carte à partager en image (`react-native-view-shot`). Fiche cheval, et sur l'Accueil du 1er décembre au 15 janvier.
- **Demi-pension** (Premium) : prénom, jours de monte, participation mensuelle. L'Accueil annonce « C'est le jour de Léa », le Budget affiche sa participation et le reste à charge. Fiche cheval → Demi-pension (propriétaire seulement).
- **Vidéo dans le Journal** (Premium) : 1 minute au plus, qualité moyenne, 50 Mo maximum, lecture dans la carte du souvenir (`expo-video`). Même stockage et mêmes règles que la photo de journal.
- **Parrainage** : chaque cavalier a un code (Profil → Parrainer un ami). Un nouveau compte (30 jours au plus, pas déjà abonné payant) saisit le code d'un ami ; au premier vrai paiement du filleul (webhook RevenueCat), le parrain reçoit 1 mois de Premium offert (octroi promotionnel RevenueCat), prolongé après son abonnement s'il en a un. 12 par an au plus. Rien à gagner avec de faux comptes. Règles testées : `apps/api/src/lib/referrals.ts`.
- **Connexion avec Google** : par le navigateur sécurisé du système (Supabase OAuth), sans SDK natif. Bouton masqué tant que `EXPO_PUBLIC_GOOGLE_AUTH` ne vaut pas `1`.
- Identité, alimentation, demi-pension et contacts : stockés d'abord sur le téléphone, synchronisés à part (`src/extras/store.ts`) ; la fusion garde la version la plus récente et ne perd jamais une fiche saisie hors ligne.

### Lot 8 — fiabilité et finitions (28 octobre)

**Relecture des lots 6 et 7**, avant leur premier passage sur un vrai iPhone. Corrigé :

- **Séance en direct** : sur Android, quand le système relance l'app en arrière-plan pour livrer des positions, celles-ci arrivaient avant la relecture du brouillon et étaient perdues. La tâche GPS attend désormais la relecture (partagée avec le démarrage de l'app). Un double toucher sur « Enregistrer la séance » créait deux séances. Fermer l'écran ouvert directement par la notification « Tout va bien ? » (app fermée, rien dessous) ne faisait rien : retour à l'Accueil.
- **Notification « Tout va bien ? » touchée pendant la séance** : la destination restait en attente et rouvrait l'écran de séance une fois celle-ci terminée. Le routeur de notifications ignore désormais un écran déjà affiché.
- **SQL pas encore exécuté** : contrairement à ce qu'annonçait le lot 7, un type précis (TREC, travail à pied, cross…) redevenait son type de base (« Balade », « Longe ») à la relecture suivante, et une vidéo de souvenir disparaissait une fois le SQL exécuté. Le téléphone retient désormais les colonnes vues absentes (`lib/schemaGaps.ts`) : tant qu'elles manquent, la version locale est gardée ; à la première relecture où elles existent, elle est gardée et renvoyée une fois (`agenda/activityKinds.ts` `mergeActivityType`, `agenda/journalMedia.ts`, testés).
- **Type précis périmé** : une ancienne version de l'app qui passait un « TREC » en « Dressage » laissait « trec » dans `activityKind`, relu tel quel. Le type précis n'est plus retenu que s'il correspond au type de base.
- **Photo ou vidéo de souvenir jamais envoyée** (réseau coupé pendant une vidéo de 50 Mo) : la ligne arrivait sans le fichier, qui n'était plus jamais renvoyé. Reprise à chaque lancement, comme pour les documents.
- **Vidéo réservée au Premium côté base** : le déclencheur qui protège la photo de journal couvre aussi `videoPath` (`rls.sql`, et `bloc-b-2026-10-27.sql` qui le remplace).
- **Connexion Google sur Android** : le retour `horsetrack://auth-callback` ouvrait « écran introuvable » par-dessus la connexion. Écran de passage ajouté.
- **Fiche cheval** : « Séance en direct » de la feuille d'ajout ne faisait rien (cas absent).
- **Anglais** : boutons des notifications (« C'est fait ✓ », « Reporter à demain », « Je vais bien »), « Rendez-vous » de la recherche et de la feuille d'ajout, deux exercices de séance, « Aujourd'hui » des dates de l'Accueil, prix « /an » et « /mois » du paywall, « Restauration… », « Connexion… », et quatre accords faits hors traduction (« 3 lefts », « sessions dones », un « , et » français dans une phrase anglaise).
- Code : une clé en double dans l'envoi des vidéos, 77 lignes vides parasites laissées par le passage à `t()`, des commentaires décrochés.
- API : la sécurité en balade reprend la règle Premium commune (`isPremiumNow`) au lieu de la recopier.

**Mesure** : `paywall_viewed`, `purchase_started` et `purchase_completed` portent le contexte promo de la session — code saisi (`promo_code_state` : none / valid / invalid ; `promo_code` et `promo_code_kind` seulement s'il est accepté), offre de retour vue (`winback_offer`), champ code promo proposé (`promo_field`). En mémoire seulement (`subscription/promoContext.ts`, testé). Politique de confidentialité complétée (« code promo accepté » parmi les exemples de mesure d'usage).

**Console `/admin`** : graphique des inscriptions par semaine (12 semaines, lundi → dimanche à l'heure de Paris, semaine en cours marquée, info-bulle par semaine, tableau des chiffres), et exports CSV des comptes, des codes et des utilisations, à ouvrir dans Excel (séparateur « ; », accents, formules neutralisées). Exports protégés comme le reste de `/admin` et revérifiés dans la route. `lib/adminReports.ts` (testé).

**Un seul « + »** (simplification C) : le « + » du Journal et celui de l'onglet Chevaux ouvrent la même feuille que l'Accueil, le Planning et la fiche cheval. Le Planning ouvre n'importe lequel de ses formulaires à l'arrivée (`?openForm=soin|rendezvous|concours|depense|journal`) : un souvenir s'écrit dans le Journal, le reste s'ouvre là où vit son formulaire, sans en dupliquer aucun. Sur l'onglet Chevaux (et la fiche quand l'écurie n'a qu'un cheval), « Un cheval » est proposé en tête.

**Onboarding** : le récapitulatif qui précède le paywall montre d'abord la fiche du cheval telle que le cavalier vient de la remplir — photo, nom, sexe, âge, race, robe, discipline, taille, poids — et les espaces qu'elle fera vivre (santé, séances, journal, budget). Seuls les champs remplis apparaissent (`onboarding/horsePreview.ts`, testé).

**Accueil découpé** sans changement de comportement : 1 029 → 453 lignes. Calculs dans `today/useTodayOverview.ts`, textes dans `today/todayFormat.ts` (testés), blocs dans `today/components/`.

**Tests de bout en bout** (Maestro, `apps/mobile/.maestro/`, mode d'emploi dans son README) : démarrage → accueil → connexion (sans compte, joué avec succès sur simulateur) ; paywall ouvert puis fermé ; code promo refusé ; achat mensuel réel en sandbox Apple jusqu'à l'écran de bienvenue. Repères `testID` posés sur les écrans concernés.

### Lot 9 — bloc C : coach IA, fil privé, bibliothèque (28 octobre)

Décisions du 28 octobre : coach réservé à Premium avec un aperçu sans IA pour les comptes gratuits ; quotas « prudents » ; notifications du fil par Expo Push ; fréquence cardiaque traitée en étude (ci-dessous), sans code.

**Coach IA (Premium)** — Claude Haiku 5.5, appelé seulement par l'API (`apps/api/src/lib/coach`), jamais par l'app.
- *Le code calcule, l'IA choisit et explique.* L'app rassemble les faits du cheval (`coach/facts.ts` : séances des 4 dernières semaines avec le résumé GPS, charge de la semaine, jours de repos et de travail d'affilée, blessures et conditions de santé, soins récents et échéances, concours, objectif, niveau, discipline, ressenti du journal, météo, jours de la demi-pension), applique les règles (`coach/constraints.ts` : règles de santé existantes de `lib/sessionContent.ts`, blessures, forme, niveaux, poney, veille, jour et lendemain de concours — un international sur 4 jours compris —, charge, vaccin, ostéopathe, gel, orage, canicule) et produit la liste fermée des exercices autorisés (`coach/exerciseLibrary.ts`). Le modèle reçoit ces faits, choisit en sortie structurée (schéma strict) ; le serveur revérifie chaque réponse (`validate.ts` : type autorisé, exercices de la liste et dans l'ordre, durée et intensité dans les bornes, aucun mot médical) et renvoie sinon la suggestion calculée par le code (`coach/suggestion.ts`). Repos imposé (jour de concours, 6 jours de travail…) : pas d'appel au modèle.
- *Trois fonctions* : « Ton coach » sur l'Accueil sous « Aujourd'hui » (prochaine séance, raison en une ou deux phrases, « Planifier » crée la séance prévue avec ses exercices en notes) ; écran « Ton coach » (questions sur le carnet : rendez-vous, échéances, dépenses par mois et catégorie, séances par mois, poids — « pas dans le carnet » plutôt que deviner) ; résumé du mois écoulé, calculé en lot (Batch API, moitié prix) par `/api/cron/coach-summaries`, ajouté au workflow GitHub des tâches planifiées.
- *Garde-fous* : symptôme ou demande de soin (boiterie, colique, fièvre, plaie, gonflement, toux, médicament…) → « appelle ton vétérinaire », sans appel au modèle ni quota consommé, avec un bouton d'appel si le vétérinaire est dans les contacts ; réponse qui parle de médicament ou de diagnostic remplacée par ce même message. Aucune donnée d'identité envoyée (ni nom du cheval, du cavalier ou d'un professionnel, ni email, ni numéros, ni texte libre) — vérifié par un test. Journal `coach_calls` : tokens, coût estimé, issue, jamais le contenu.
- *Coût et arrêt* : `COACH_ENABLED=1` (interrupteur) + `ANTHROPIC_API_KEY` ; plafond mensuel côté serveur `COACH_MONTHLY_BUDGET_USD` (10 $ par défaut), en plus du plafond du compte Anthropic. Coach coupé ou plafond atteint : l'app affiche la suggestion de l'app, « Le coach fait une pause ». Prompt système unique et figé, mis en cache ; effort bas ; sorties bornées.
- *Quotas Premium* : une suggestion IA par cheval et par jour (3 chevaux), relue ensuite ; 30 questions par mois ; un résumé par cheval et par mois (3 chevaux).
- *Gratuit* : la même carte avec la suggestion calculée par l'app, sans l'explication ; questions et résumé → paywall « coach » (nouveau point d'entrée, nouvelle ligne du comparatif et des bénéfices).
- *Jeu de cas* : 37 cas (25 suggestions : routine, tendinite en récupération, arthrose, veille et jour de concours, international sur 4 jours, lendemain de concours, poney et débutant, débutant sur cheval de CSO, 6 jours d'affilée, deux séances intenses, gel, canicule, orage, demi-pension, vaccin, ostéopathe, remise en forme, cheval au repos, jeune cheval, endurance GPS, souffle, fourbure, app en anglais, ressentis difficiles ; 10 questions dont une sans réponse dans le carnet, un symptôme, un hors-sujet et un conseil de soin déguisé ; 2 résumés). La part du code est testée à chaque `vitest` (les contraintes et la suggestion de repli respectent déjà chaque cas). La part du modèle se lance à la main (cf. « Non vérifié »).

**Fil privé d'un cheval** — pas de réseau public : commentaires et réactions (5 emojis) sur une séance ou un souvenir, entre le propriétaire et les partages acceptés (RLS `can_access_horse`). Le rôle de l'auteur est posé par la base (trigger) ; l'app n'affiche que « Toi » ou le rôle, jamais un email. Suppression par l'auteur, ou par le propriétaire pour tout son fil ; signalement → console `/admin` (supprimer ou classer, à traiter sous 24 h, règle App Store 1.2). Notifications push via Expo Push (gratuit) : jeton enregistré par l'API seulement si les notifications sont déjà autorisées, retiré à la déconnexion ; l'API relit le commentaire et choisit seule les destinataires ; 30 notifications par heure et par auteur au plus ; jetons morts purgés. Entrées : bouton « Commentaires » dans une séance ou un souvenir déplié (cheval partagé seulement), module « Fil » de la fiche cheval, notification → fil de la séance.

**Bibliothèque d'exercices** — les ~100 exercices de `lib/sessionContent.ts`, chacun avec un identifiant stable, une discipline, un niveau minimum, une intensité et son matériel (`coach/exerciseLibrary.ts`, testé). Écran « Exercices » depuis le Planning : recherche (sans accents), filtres discipline, sans matériel, favoris (gardés sur le téléphone), ajout en un toucher aux notes de la prochaine séance prévue ou dans une nouvelle séance du jour. Champ vidéo prêt (`videoUrl`), vide tant qu'aucun contenu sous droits n'est fourni. Le coach choisit dans cette même bibliothèque.

**Fréquence cardiaque (HealthKit) — étude, pas de code**
- *Sans app Apple Watch* : l'iPhone n'a pas de capteur cardiaque. Santé ne contient une fréquence cardiaque que si une montre ou une ceinture l'y écrit (Apple Watch, ou l'app d'une marque tierce). Hors entraînement lancé sur la montre, l'Apple Watch ne mesure que par intermittence ; pendant un entraînement lancé dans l'app Exercice, un échantillon toutes les quelques secondes. La synchronisation montre → iPhone est différée (de quelques secondes à plusieurs minutes) : une **fréquence en direct dans l'écran de séance n'est pas fiable** sans une app watchOS dédiée (hors périmètre).
- *Faisable* : **après la séance**, lire dans Santé les mesures entre le début et la fin de la séance en direct (moyenne, maximum, temps par zone, courbe), et en option écrire la séance dans Santé comme entraînement « sports équestres » avec sa distance.
- *Coût* : un module natif (ex. `@kingstinct/react-native-healthkit`), le droit HealthKit, deux textes d'autorisation, nouveau build ; ≈ 3 à 4 jours iOS, + 2 à 3 jours pour Health Connect sur Android, tests sur un vrai iPhone avec montre.
- *Règles* : App Store 5.1.2/5.1.3 (données de Santé jamais pour la publicité, pas dans iCloud, seulement les types nécessaires, politique de confidentialité) ; la fréquence cardiaque du cavalier est une donnée de santé au sens du RGPD (art. 9) : consentement explicite, et à garder sur le téléphone plutôt que sur nos serveurs.
- *Valeur* : c'est le cœur du cavalier, pas celui du cheval (qui demanderait une ceinture équine, exclue). Recommandation : ne pas le faire maintenant ; si des cavaliers le demandent, import après séance, local, iOS d'abord.

### Tableau de bord PostHog (à créer une fois)

Les événements partent dès que `EXPO_PUBLIC_POSTHOG_KEY` est renseignée dans le build.

1. **Tunnel d'activation** (Insight « Funnel », fenêtre 14 jours) : `onboarding_completed` → `horse_added` → `session_created` → `session_completed` → `paywall_viewed` → `purchase_completed`.
2. **Rétention** (Insight « Retention ») : premier événement `onboarding_completed`, retour `app_opened`, par semaine ; lire J1, J7, J30.
3. **Usage réel** (Insight « Trends », utilisateurs uniques par semaine) : `session_completed`. C'est l'indicateur principal à suivre.
4. **Rappels** : `session_reminder_action` découpé par `action` (done / tomorrow), et `notification_opened` par `destination`.
5. **Conversion** : `paywall_viewed` → `purchase_completed` découpé par `placement` ; `winback_offer_viewed` → `winback_offer_tapped` → `promo_store_redeem_opened`.
7. **Coach** : `coach_session_planned` (par `source` : ai / code), `coach_question_asked` (par `status`), `paywall_viewed` avec `placement = coach` → `purchase_completed`. Fil : `comment_posted`, `reaction_added`, `comment_reported`. Bibliothèque : `exercise_added_to_session`, `exercise_favorited`.
6. **Effet des campagnes** : `paywall_viewed` → `purchase_completed` découpé par `promo_code_state`, puis par `promo_code` ; même tunnel découpé par `winback_offer`.

## 3. Mise en service, dans cet ordre

1. **Base** : exécuter `packages/db/prisma/promo-codes-v2-2026-10-26.sql` dans l'éditeur SQL Supabase. Le script est additif et idempotent, et les codes existants gardent leur comportement. **À faire avant de déployer l'API.**
2. **API (Vercel)** : ajouter `ADMIN_USER` et `ADMIN_PASSWORD` (16 caractères minimum), puis déployer. `APP_STORE_ID` est facultatif (6786889092 par défaut).
3. **App Store Connect**, pour chaque remise : Abonnements → Codes d'offre → code personnalisé, avec la même remise et la même date de fin. Créer ensuite le code dans `/admin` (type « Remise sur l'abonnement »).
4. **Offre de retour** (facultatif) : un code d'offre App Store Connect réservé aux anciens abonnés, puis le même code dans `/admin`, type « Remise sur l'abonnement », éligibilité « Anciens abonnés », campagne `retour`.
5. **App** : les changements mobiles partent avec le prochain build EAS (obligatoire : `expo-haptics`, `react-native-gesture-handler`, `expo-calendar`, `expo-task-manager` et `@bacons/apple-targets` sont des modules natifs). Le premier build iOS demandera de créer le profil de la cible widget (`com.horsetrack.app.widget`) et l'App Group : lancer `eas build` en mode interactif une fois.
6. **Lot 6** : exécuter `packages/db/prisma/seances-en-direct-2026-10-27.sql` (tables `training_session_rides` et `ride_shares`), puis déployer l'API. Pour que les emails de sécurité arrivent aux proches, `RESEND_FROM_EMAIL` doit utiliser un domaine vérifié dans Resend (l'adresse de test `onboarding@resend.dev` n'écrit qu'au propriétaire du compte Resend). Facultatif : `PUBLIC_BASE_URL` si l'API a un domaine personnalisé.
7. **Lot 7** : exécuter `packages/db/prisma/bloc-b-2026-10-27.sql`, **de préférence avant de publier le build** : l'app tolère son absence et rattrape ensuite les types de séance et les vidéos (cf. lot 8), mais l'ordre inverse évite tout rattrapage. Vérifier dans Supabase → Storage → `horse-photos` que les vidéos `video/mp4` sont acceptées (types autorisés, taille ≥ 50 Mo). Parrainage : la clé `REVENUECAT_SECRET_API_KEY` doit être une clé v1 avec droit d'écriture (octroi promotionnel). Google : créer un identifiant OAuth « Application Web » dans Google Cloud, l'activer dans Supabase → Authentication → Providers → Google, ajouter `horsetrack://auth-callback` aux adresses de redirection autorisées, puis `EXPO_PUBLIC_GOOGLE_AUTH=1` dans `eas.json`.
8. **Tests de bout en bout** : créer deux comptes Horsetrack de test (un gratuit, un jamais abonné) et un compte testeur sandbox dans App Store Connect, puis lancer les parcours de `apps/mobile/.maestro` sur le build TestFlight (cf. son README).
9. **Lot 9 (bloc C)** :
   - exécuter `packages/db/prisma/bloc-c-2026-10-28.sql` **avant** de déployer l'API ;
   - Anthropic : créer une clé API dans un espace de travail dédié, acheter des crédits prépayés (10 $ suffisent largement pour démarrer), fixer un plafond de dépense mensuel dans la console Anthropic (5 à 10 $) ;
   - Vercel : `ANTHROPIC_API_KEY`, `COACH_ENABLED=1`, `COACH_MONTHLY_BUDGET_USD` (10 par défaut), puis déployer ; couper `COACH_ENABLED` suffit pour arrêter le coach ;
   - EAS : au prochain build iOS, accepter la création de la clé de notifications push (APNs) proposée par EAS (ou `eas credentials`) ; Android : rien de plus si le projet FCM est déjà configuré, sinon `google-services.json` ;
   - App Store Connect, « Confidentialité de l'app » : ajouter « Contenu généré par l'utilisateur » (commentaires) et l'envoi de données à un prestataire d'IA ; dans la fiche, mentionner le fil privé et le signalement.
10. **App Store Connect** : déclarer la localisation dans « Confidentialité de l'app » (Localisation précise, liée à l'utilisateur, fonctionnalité de l'app), ajouter la langue anglaise à la fiche (description, mots-clés, captures).

## 4. Risque à arbitrer : règle App Store 3.1.1

Apple interdit de débloquer des fonctions payantes par un mécanisme propre à l'app (« license keys… »). Le type **Jours de Premium**, qui existait avant ce lot, en est un. Il est passé en revue jusqu'ici, mais un relecteur peut le refuser à tout moment.

Recommandation : pour le grand public, privilégier les **offres store**, qui passent par Apple et sont toujours conformes. Réserver les jours Premium aux partenariats ciblés (ambassadeurs, salons), ou les remplacer par l'octroi promotionnel RevenueCat, déjà géré par l'app (« Premium offert »).

## 5. Simplifier la logique d'utilisation (sprint 2 proposé)

| # | Constat dans le code | Proposition |
|---|---|---|
| A ✅ | L'Accueil empile jusqu'à 13 blocs, et « Aujourd'hui » (les séances du jour, actionnables) n'arrive qu'en 9ᵉ position, après la météo, les notifications, les alertes, les premiers pas, le bilan du mois et l'offre rappels. | « Aujourd'hui » juste sous l'en-tête, avec la case à cocher ; les alertes ensuite ; le reste plus bas ou repliable. |
| B ✅ | Trois notions se recouvrent : le **cheval actif** (Accueil, Planning, ajouts), le **filtre par cheval** (Planning, Journal, avec « Tous ») et la **fiche consultée**. Le Journal doit écrire « La nouvelle entrée sera rattachée à X (cheval actif) » pour lever le doute. | Un seul sélecteur de cheval, en haut, partagé par tous les onglets, avec « Tous » ; chaque ajout demande le cheval seulement s'il y a ambiguïté. |
| C ✅ | Ajouter n'a pas le même geste partout : formulaire déplié dans la liste (Planning, Journal), bouton « + » flottant (fiche cheval), bouton qui change d'onglet (« Planifier une séance » de l'Accueil). | Un seul « + » qui ouvre le même choix (séance, soin, concours, dépense, souvenir) dans une feuille, depuis n'importe quel onglet. |
| D ✅ | Le Planning affiche titre, sous-titre, Liste/Mois, Statistiques, « Ajouter » et 5 filtres sur deux lignes avant le premier événement. | Filtres sur une ligne défilante, « + » dans l'en-tête, statistiques résumées en une carte. |
| E ✅ | Une carte de souvenir répète la météo et le ressenti (en-tête puis corps) et affiche « Modifier / Supprimer cette entrée ». | Photo pleine largeur, texte, actions dans l'appui long et le balayage (déjà là). |
| F ✅ | La fiche cheval a deux « Modifier » (crayon sur la photo et bouton). | Garder le crayon, remplacer le bouton par « Planifier » ou « Ajouter ». |

## 6. Feuille de route (impact / effort)

Chaque point vient d'un constat dans le code. Les estimations sont des ordres de grandeur.

### Priorité 1 — fort impact, effort faible

| # | Amélioration | Constat | Effort |
|---|---|---|---|
| 1 ✅ | Libellés VoiceOver sur les boutons-icônes (Chevaux, Journal, fiche cheval) | Onglet Chevaux : 0 libellé pour 9 éléments touchables ; Journal : 0 pour 3 | ½ j |
| 3 ✅ | Offre de reconquête à l'expiration (code « anciens abonnés ») | Le placement `trial_ending` existe, sans offre dédiée | ½ j + ASC |
| 4 ✅ | Événement `paywall_viewed` enrichi de la présence d'un code promo | Mesure de l'effet des campagnes | ¼ j |

### Priorité 2 — fort impact, effort moyen

| # | Amélioration | Constat | Effort |
|---|---|---|---|
| 5 ✅ | Découper `planning.tsx` (1 544 lignes) et `today.tsx` (893 lignes) | Risque de régression à chaque modification, rendus coûteux | 2–3 j |
| 6 ✅ | Proposer l'échéance suivante selon le soin (vermifuge, vaccin, maréchal), modifiable | L'échéance et son rappel existent, mais la date se saisit à la main (`AppointmentForm`, aucune suggestion) : c'est le geste le plus souvent oublié | 1 j |
| 7 | Pastille sur l'icône de l'app pour les soins en retard | Les alertes (`horses/alerts.ts`) ne se voient qu'en ouvrant l'Accueil ; aucune pastille sur l'icône | 1 j |
| 8 ✅ | Onboarding : montrer une fiche cheval remplie avant le paywall | Le paywall arrive avant la première valeur perçue | 1–2 j |

### Priorité 3 — à planifier

| # | Amélioration | Effort |
|---|---|---|
| 9 ✅ | Icônes de catégories qui suivent le thème actif (limite notée dans `palettes.ts`) | 1 j |
| 10 ✅ | Thème sombre complet | 3 j |
| 11 (faisable, cf. lot 5) | Widget iOS « prochain soin » (dossier `targets/` déjà présent) | 3 j |
| 12 ✅ | Console admin : export CSV, graphique des inscriptions | 1 j |
| 13 ✅ (à jouer avec des comptes de test) | Tests de bout en bout du parcours d'achat (Maestro, sandbox) | 2 j |

## 7. Non vérifié dans ce lot

- **Lot 9** : vérifié — 560 tests mobile (dont les 25 cas de suggestion pour la part du code), 107 tests API, typecheck, lint (0 erreur), bundles iOS et Android, build de l'API. **Pas encore lancé : le jeu de cas contre Claude Haiku 5.5** (aucune clé Anthropic disponible sur la machine). À lancer depuis `apps/api` : `COACH_EVAL=1 npx vitest run src/lib/coach/eval` (clé lue dans `apps/api/.env.local`) — le rapport (réussites, problèmes par cas, tokens, cache, coût réel par appel) est écrit dans `src/lib/coach/eval/report.json`. Coût estimé, à confirmer par ce rapport : ≈ 0,0005 $ par suggestion, ≈ 0,0005 $ par question, ≈ 0,0002 $ par résumé en lot ; pire cas d'un compte Premium aux quotas ≈ 0,03 $ par mois. Si Haiku échoue sur certains cas, trois options à arbitrer : affiner le prompt, durcir les règles côté code, ou Claude Sonnet 5.5 pour ces cas seulement. Non vérifiés non plus : les écrans du coach, du fil et de la bibliothèque à l'écran (compte de test nécessaire), les notifications push (build EAS et vrai téléphone), le résumé du mois en lot (cron + clé).

- **Lot 8** : vérifié — 516 tests mobile, 86 tests API, typecheck, lint (0 erreur), bundles iOS et Android, build de l'API, démarrage sur simulateur avec le parcours Maestro `smoke-launch` (accueil → écran d’inscription → connexion, sans créer de compte), graphique de la console rendu en clair et en sombre avec des données d'exemple. Non vérifié : le récapitulatif d'onboarding avec la fiche (il faut créer un compte, ce qui n'a pas été fait sur la base de production), le « + » du Journal et de Chevaux, la console `/admin` et ses exports avec la vraie base, les trois parcours Maestro qui demandent un compte (`account`, `sandbox`), le rattrapage des colonnes une fois le SQL exécuté, et la reprise GPS quand Android relance l'app en arrière-plan.

- **Lot 7** : ni la vidéo, ni le partage du bilan en image, ni la connexion Google, ni la récompense de parrainage n'ont été essayés de bout en bout (il faut le SQL, un compte de test et, pour Google, la configuration Supabase). Vérifié : 491 tests mobile, 79 tests API, typecheck, lint, bundles iOS et Android, build de l'API.

- **Lot 6** : la séance en direct et la sécurité en balade n'ont pas été essayées en extérieur avec un vrai GPS, ni le widget posé sur un écran d'accueil. Vérifié : 460 tests mobile, 73 tests API, typecheck, lint, bundles iOS et Android, build de l'API, compilation native de l'app et du widget, démarrage sur simulateur en français et en anglais. Les seuils d'allure (pas < 7,5 km/h, trot < 15 km/h) sont à confirmer sur de vraies séances, poneys compris. La traduction anglaise est faite par Claude : à faire relire par un anglophone (73 textes sont découpés autour de valeurs et peuvent sonner moins naturellement). Les emails envoyés par l'API (invitations, sécurité en balade) restent en français.

- **Rendu sur appareil** des changements mobiles : typecheck, lint et tests passent, les bundles iOS et Android compilent (`expo export`), et l'app compile nativement avec Xcode 26.6 (simulateur iPhone 17 Pro, iOS 26), puis démarre sans erreur jusqu'à l'onboarding. Les écrans connectés n'ont pas pu être vus sans compte de test. À contrôler sur TestFlight : mode sombre sur chaque écran (Profil → Apparence → Sombre), sélecteur de cheval unique (Planning, Journal), barre d'onglets native (y compris sur un iPhone en iOS 16), transition zoom, menu d'appui long, balayage des cartes, case à cocher des séances, skeleton du paywall, champ code promo, retours haptiques, animations d'ouverture et bandeau météo.
- **Console admin avec de vraies données** : compilation et protection vérifiées sur un serveur local, volontairement sans connexion à la base de production.
- **Migration** : le script SQL n'a pas été exécuté.
