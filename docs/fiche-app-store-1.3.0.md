# Fiche App Store — 1.3.0 (proposition, à valider avant de coller)

Principes (skill `aso`, app « challenger » : ~12 avis) :
- Apple indexe **nom + sous-titre + mots-clés** ; ne jamais répéter un mot d'un champ dans un autre
  (« cheval », « soins », « concours » sont déjà dans le nom et le sous-titre).
- Mots-clés : **100 octets** (un accent compte pour 2) : sans accent, sans espace, séparés par des virgules.
  Apple ne tient pas compte des accents ni du pluriel.
- Aucune promesse invérifiable, aucun avis ni chiffre inventé, pas de nom de concurrent.
- Ne pas changer le **nom** : il porte l'historique de classement actuel.
- Écurie Pro n'apparaît nulle part (en pause).

## Français

| Champ | Texte | Longueur |
|---|---|---|
| Nom (inchangé) | Horsetrack : suivi du cheval | 28 / 30 |
| Sous-titre | Soins, séances GPS, concours | 28 / 30 |
| Mots-clés | `equitation,ecurie,veto,marechal,osteo,vaccin,vermifuge,dressage,cso,obstacle,gps,demi-pension,coach` | 99 / 100 octets |
| Texte promotionnel | Nouveau : un démarrage en 1 minute, des séances Plat et Barres au sol, et le tracé GPS coloré par allure. Séance en direct gratuite. | 135 / 170 |

Sous-titre : « séances GPS » ajoute une requête que les cavaliers tapent (suivi GPS d'une sortie) et que
l'ancien sous-titre ne couvrait pas. Mots-clés : « ostéo », « obstacle », « gps » ajoutés ; « budget »,
« cavalier » (peu de volume, déjà couverts par la description) retirés pour tenir les 100 octets.

### Nouveautés de la version 1.3.0 (à compléter avec `soumission-app-store-1.3.0.md`)

• Démarre en 1 minute : ton cheval, puis son premier soin ou sa première séance
• Nouvelles séances : Plat, Barres au sol / cavaletti, et Concours dans le journal
• Tracé GPS coloré par allure (pas, trot, galop) sur tes séances
• Un jour de repos occupe désormais la journée entière
• Séance en direct gratuite pour tous : chrono, GPS, allures, export GPX
• Relire une séance, la partager en story, météo plus fiable, progression de ton cheval

## English

| Field | Text | Length |
|---|---|---|
| Name (unchanged) | Horsetrack: Horse Care Log | 26 / 30 |
| Subtitle | Care, GPS rides & competitions | 30 / 30 |
| Keywords | `equestrian,riding,stable,vet,farrier,osteopath,vaccine,dressage,jumping,gps,coach,rider,planner` | 97 / 100 |
| Promotional text | New: a 1-minute start, Flatwork and Ground poles sessions, and your GPS route coloured by gait. Live rides are free. | 117 / 170 |

### What's New in 1.3.0

• Start in 1 minute: your horse, then its first care or first ride
• New sessions: Flatwork, Ground poles / cavaletti, and Competition in your journal
• GPS route coloured by gait (walk, trot, canter) on your rides
• A rest day now covers the whole day
• Live rides are free for everyone: timer, GPS, gaits, GPX export
• Replay a ride, share it as a story, more reliable weather, your horse's progress

## Ce qui pèse le plus sur les téléchargements (par ordre d'effet attendu)

1. **Captures d'écran** (non testables d'ici) : les 3 premières décident. Ordre proposé : Accueil avec le
   cheval et « Premiers pas » · Séance en direct avec tracé coloré · Santé et prochaines échéances ·
   Coach IA · Partage avec la demi-pension. Une phrase courte par capture, sans chiffre inventé.
2. **Note et avis** : 5 étoiles sur 12 avis. Le plus rentable est d'en obtenir davantage (cf.
   `reviewPromptLogic.ts`, déjà en place) ; ne jamais en promettre ni en citer sur la fiche.
3. **Vidéo d'aperçu** de 15 à 30 s : la séance en direct, du démarrage au tracé coloré.
4. **Événements in-app** (Apple) : un par saison (concours, rentrée) pour être visible hors recherche.
5. **Localisation** : la fiche anglaise existe ; mesurer dans App Store Connect d'où viennent les
   impressions avant de traduire davantage.

## À mesurer dans App Store Connect avant/après (à 14 jours)
Impressions, vues de la page, taux de conversion (téléchargements / vues), requêtes de recherche.
Ne changer qu'un champ à la fois pour savoir ce qui a joué. Le sous-titre et les mots-clés se modifient
avec chaque version ; le texte promotionnel à tout moment, sans nouvelle version.
