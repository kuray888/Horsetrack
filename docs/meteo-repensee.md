# Cahier — Météo repensée

## Problème
La météo est un bandeau de 5 jours (température min/max, libellé, **emoji** ☀️ 🌧️) et une
météo collée aux entrées du journal. Elle ne répond pas à la question du cavalier : « je monte
quand, et je le couvre comment ? ». Le coach connaît déjà des contraintes météo
(`coach/constraints.ts` : gel, orage), mais elles ne se voient pas sur la météo.

## Fournisseur — décidé le 2026-11-11 (aucun budget)
- **Avant** : `api.open-meteo.com` appelé depuis le téléphone, sans clé. L'accès gratuit
  d'Open-Meteo exclut « les apps qui ont des abonnements » ; aucune attribution ; position GPS
  exacte envoyée (arrondie au km depuis le 11/11).
- **Maintenant (1.3.0)** : **MET Norway** (Locationforecast 2.0), données sous NLOD 2.0 et
  CC BY 4.0, qui permettent l'usage commercial, gratuites, monde entier, 9 jours.
  Conditions de MET respectées : les apps ne l'appellent pas directement, notre route
  `GET /api/weather` (connexion exigée) l'interroge avec un User-Agent identifié, garde chaque
  réponse jusqu'à `Expires` puis redemande avec `If-Modified-Since`, et n'envoie que la position
  arrondie à 0,01°. Moins de 20 requêtes/s au total : très loin des volumes actuels.
- Attribution « Prévisions : MET Norway » sous le bandeau, lien vers la licence.
- Politique de confidentialité : ligne MET Norway ajoutée (section 5).
- **La 1.2.0 en revue appelle encore Open-Meteo** ; à remplacer par la 1.3.0 au plus vite.
- WeatherKit d'Apple (gratuit jusqu'à un quota) reste possible plus tard, mais il demande une
  clé à créer dans le compte développeur et le logo Apple Weather.

## Proposition
- **Aujourd'hui en un coup d'œil** sur l'Accueil : la meilleure plage pour monter dans les
  12 h (pas de pluie, vent < 30 km/h, 5–25 °C, réglable), et une ligne « tenue / couverture »
  (logique pure : température ressentie, pluie, vent → « couverture légère au pré ce soir »).
- **Alertes** reliées aux contraintes du coach : gel (sol dur), canicule (> 30 °C : séance
  tôt), vent fort, orage. Affichées dans l'app, **pas de nouvelle notification** (aucune
  relance hors du tableau de CLAUDE.md ; si un jour on en veut, elle y entre d'abord).
- **Design** : icônes `weather-*` de l'app au lieu des emoji, couleurs des jetons du thème
  (6 palettes × clair/sombre), squelette pendant le chargement.
- **Hors ligne / sans permission** : dernière prévision gardée avec son heure (« il y a
  3 h ») ; sans localisation, choix d'une commune (une fois, gardée sur le téléphone).

## Gratuit / Premium
Bulletin du jour et 5 jours : gratuit (déjà le cas). **Livré gratuit en 1.3.0** (2026-11-11) :
« Pour monter aujourd'hui : 11 h – 16 h, jusqu'à 12° » et les alertes gel / chaleur / vent /
orage (`weather/rideWindow.ts`), parce que c'est un motif d'ouvrir l'app chaque jour
(rétention). Le passer Premium plus tard retirerait une fonction à des gratuits : à décider
avant la sortie de la 1.3.0 si tu le veux Premium.

## Données
Rien de nouveau côté serveur si on reste sur Open-Meteo (appel depuis le téléphone). Avec
WeatherKit, l'appel passe par l'API (clé privée côté serveur) : cache par **maille ~10 km et
par langue** (leçon de la 1.2.0), aucune donnée liée au compte.

## Événements
`weather_viewed` (`{ source: "home" | "planning" }`), `weather_alert_shown` (`{ kind }`),
`weather_location_set` (`{ mode: "gps" | "commune" }`).

## Cas limites
Fuseau à l'étranger, prévision absente pour un jour, codes WMO inconnus (libellé neutre),
position refusée, API en panne (dernière prévision, jamais d'écran vide), palettes sombres.

## Plan de test
Logique pure (plage idéale, tenue, alertes) sur des prévisions types ; captures 6 palettes ×
clair/sombre × FR/EN ; VoiceOver (« Meilleure plage : 14 h – 16 h, 12 °C, sans pluie »).
