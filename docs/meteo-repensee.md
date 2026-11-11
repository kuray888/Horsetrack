# Cahier — Météo repensée

## Problème
La météo est un bandeau de 5 jours (température min/max, libellé, **emoji** ☀️ 🌧️) et une
météo collée aux entrées du journal. Elle ne répond pas à la question du cavalier : « je monte
quand, et je le couvre comment ? ». Le coach connaît déjà des contraintes météo
(`coach/constraints.ts` : gel, orage), mais elles ne se voient pas sur la météo.

## Trois constats à régler d'abord (conformité)
1. **Licence** : l'app appelle `api.open-meteo.com` sans clé. L'accès gratuit d'Open-Meteo est
   réservé à l'usage **non commercial** ; Horsetrack est une app payante. → **Décision pour toi** :
   souscrire l'offre commerciale d'Open-Meteo (abonnement mensuel, clé d'API, adresse
   `customer-api.open-meteo.com`) ou changer de fournisseur (ex. Apple WeatherKit : inclus
   dans le compte développeur jusqu'à un quota d'appels mensuel, attribution Apple obligatoire,
   appel via le serveur avec une clé privée). Vérifie les conditions et prix du jour avant de
   choisir.
2. **Attribution** : les données Open-Meteo sont sous licence CC BY 4.0 ; l'app ne cite la
   source nulle part. À ajouter sous le bandeau (« Météo : Open-Meteo.com », lien).
3. **Vie privée** : la position partait exacte chez Open-Meteo ; **corrigé le 2026-11-11**
   (arrondie au km, `lib/weatherRequest.ts`). La politique de confidentialité ne nomme pas ce
   destinataire : texte proposé ci-dessous, à valider par toi (juridique).
   > « Météo : pour afficher la météo, une position approximative (à environ 1 km) est
   > envoyée à notre fournisseur de prévisions, Open-Meteo (Suisse), sans aucun identifiant. »

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
Bulletin du jour et 5 jours : gratuit (déjà le cas). Plage idéale et alertes liées au coach :
Premium. → **Décision pour toi.**

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
