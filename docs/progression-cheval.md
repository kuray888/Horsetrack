# Cahier — Progression visuelle du cheval

## Problème
Les données sont là (séances, allures GPS, poids, soins, concours, dépenses, objectifs) mais
dispersées : écran poids, rapport du mois, carte « Mon année », jalons (`HorseMilestonesCard`).
Le cavalier ne voit pas d'un coup d'œil si son cheval progresse — le meilleur moteur de
rétention et de recommandation (« regarde son année »).

## Utilisateur
Propriétaire et demi-pension ; le coach qui suit plusieurs chevaux.

## Proposition
Un écran « Progression » dans la fiche du cheval (`HorseHub`, là où on le cherche), sans
nouvelle saisie :
- **Six axes**, chacun une courbe sur 3 / 6 / 12 mois avec comparaison à la période
  précédente : poids, charge de travail (minutes × intensité par semaine), régularité
  (semaines avec ≥ 1 séance), concours (résultats), soins (à jour / en retard), budget.
- **Jalons** datés sur la frise (100ᵉ séance, premier concours, poids stabilisé…), réutilisant
  `HorseMilestonesCard`.
- **Carte partageable** (image, couleurs de la marque, photo du cheval si présente) :
  `react-native-view-shot` déjà installé, comme « Mon année ».
- Graphiques en SVG maison (`react-native-svg`, déjà là) : pas de bibliothèque lourde.
  Animation à l'apparition (tracé qui se dessine, 300 ms, natif), rien avec « Réduire les
  animations ». Chaque graphique a un résumé textuel pour VoiceOver (« Poids : 512 kg,
  +4 kg en 3 mois »).

## Gratuit / Premium
Proposition : régularité et dernière période gratuites ; historique complet, comparaison et
carte partageable Premium. Rien de ce qui est gratuit aujourd'hui ne passe Premium. →
**Décision pour toi.**

## Données et RLS
Aucune table nouvelle : calculs côté téléphone sur les données déjà synchronisées. La
demi-pension voit les axes qu'elle voit déjà (budget seulement si ses droits le permettent :
réutiliser les mêmes droits que l'écran budget, `rights.*`).

## Événements
`progress_viewed` (`{ axis, range }`), `progress_shared`, `milestone_reached` (`{ kind }`).

## Cas limites
Cheval créé hier (état vide qui dit quoi faire : « Note 3 séances pour voir ta première
courbe »), données clairsemées (points, pas de ligne trompeuse), changement de cheval, 1 vs N
chevaux, unités (kg/lb si l'anglais l'exige — aujourd'hui kg partout), anglais.

## Plan de test
Logique pure des séries (agrégation hebdomadaire, comparaison de périodes, jalons) avec des
jeux de données types ; captures clair/sombre ; VoiceOver.

## Jalon
J1 : régularité + charge de travail + poids. J2 : concours, soins, budget, carte partageable.
