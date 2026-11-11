# Cahier — Séance GPS relue

## Problème
Après une séance en direct, le cavalier voit un tracé sans fond de carte (`RouteTrace`, SVG),
la distance, la vitesse moyenne et la répartition des allures. Il ne peut ni revoir la séance
(où il a trotté, galopé, monté), ni la partager joliment, ni l'exporter. C'est le moment le
plus « fier » de l'app ; il n'est pas mis en valeur.

## Utilisateur
Cavalier d'extérieur ou d'endurance, et cavalier de concours qui suit le travail de fond.

## Ce qu'on a aujourd'hui (et ce qui manque pour aller plus loin)
- Points enregistrés pendant la séance (`RidePoint` : heure, lat, lng, précision, vitesse),
  **sans altitude**.
- À la fin, seulement ~600 points gardés et encodés en polyligne **sans heure ni vitesse**
  (`training_session_rides.route`). Impossible donc de colorer le tracé par allure, de rejouer
  la séance dans le temps ou de calculer un dénivelé à partir de ce qui est stocké.

## Proposition par jalons
1. **J1 — relecture sans carte (aucune dépendance nouvelle)** : enregistrer aussi l'altitude
   (`loc.coords.altitude`, `altitudeAccuracy`) ; stocker une **trace détaillée** (heure relative,
   lat, lng, vitesse, altitude) à côté de la polyligne ; écran « Relire » : tracé coloré par
   allure, curseur pour rejouer (Animated natif, 2D), courbes vitesse et altitude (SVG),
   dénivelé positif/négatif avec altitude **lissée** (médiane glissante + seuil d'hystérésis
   de 3 m, logique pure testée sur des traces bruitées réelles).
2. **J2 — partage et export** : carte du parcours partageable (image `react-native-view-shot`,
   déjà installé, aux couleurs de la marque, sans position de l'écurie si l'utilisateur le
   demande : départ/arrivée masqués à 200 m près) ; export GPX (`expo-sharing`).
3. **J3 — fond de carte** : seulement si J1 est utilisé (`ride_replay_opened`). Options à
   comparer au moment voulu : `react-native-maps` (Apple Plans sur iOS, sans clé) ou `expo-maps`.
   Les deux imposent un build de développement (plus d'Expo Go pour cet écran) ; attribution
   affichée par le fournisseur. 3D écartée tant que la 2D n'a pas prouvé son usage.
4. **J4 (option)** — chronomètre intelligent (intervalles, objectifs d'allure) ; Live Activity /
   Dynamic Island pour la séance en cours (extension iOS native, chantier à part).

## Gratuit / Premium
La séance en direct et son tracé restent comme aujourd'hui (aucun retrait). Proposition :
relecture animée, courbes et dénivelé **Premium** ; export GPX **gratuit** (portabilité des
données). → **Décision pour toi** (formule).

## Données et RLS
- Trace détaillée : ~1 point/s, 2 h ≈ 7 200 points ≈ 100–150 Ko en JSON compressé. Pas dans la
  table : **Supabase Storage**, bucket privé `ride-traces`, chemin `{horseId}/{sessionId}.json.gz`,
  mêmes règles que les photos du cheval (lecture : propriétaire + partages du cheval ; écriture :
  qui peut écrire la séance). La table `training_session_rides` garde la polyligne (aperçu).
- **Suppression** : le fichier part avec la séance, le cheval et le compte. La suppression du
  compte vide déjà les dossiers des chevaux du compte, récursivement (cf. audit final § 3) :
  à vérifier par un test RLS/Storage (`tests/rls/80-stockage.test.sql`) et un test de la route
  de suppression. Supprimer une séance doit supprimer son fichier (aujourd'hui seule la ligne
  part en cascade).
- Anciens abonnés : rien ne change pour eux ; les anciennes séances n'ont pas de trace
  détaillée et affichent la relecture simple (tracé uni), sans message d'erreur.

## Conformité
- Localisation : déjà « pendant l'utilisation » + arrière-plan pendant une séance ; rien de
  nouveau. Le partage d'une carte du parcours révèle un lieu : aperçu avant partage, masquage
  du départ proposé par défaut.
- Aucun envoi à un tiers en J1/J2. En J3, les tuiles viennent du fournisseur de carte :
  à dire dans la politique de confidentialité.

## Événements
`ride_replay_opened`, `ride_replay_scrubbed`, `ride_shared` (`{ masked: bool }`),
`ride_gpx_exported`. Aucune position dans les propriétés.

## Cas limites
GPS absent (manège) → pas de bouton « Relire ». Trace interrompue (app tuée) → relecture
jusqu'au dernier point sauvé. Précision > 30 m → point ignoré pour l'altitude. Séance de
plus de 4 h → sous-échantillonnage à 1 point / 2 s. Hors ligne → trace mise en file, la
relecture fonctionne depuis le téléphone. Cheval partagé : la demi-pension voit la trace si
elle voit la séance.

## Plan de test
Logique pure (lissage d'altitude, dénivelé, allure par segment, GPX valide) avec vitesse ;
`test:rls` pour le bucket ; simulateur : trace GPX rejouée par `xcrun simctl location`,
captures clair/sombre/anglais, VoiceOver (résumé textuel de la courbe), « Réduire les
animations » (curseur sans animation).

## Coûts
Storage : 150 Ko × séances GPS. Négligeable aux volumes actuels ; à surveiller au-delà de
10 000 séances GPS (1,5 Go).
