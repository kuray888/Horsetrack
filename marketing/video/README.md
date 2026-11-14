# Chaîne vidéo HorseTrack

## Reproduire le lot 1
```bash
./setup.sh   # une fois : Piper + voix française fr_FR-siwis-medium (≈ 65 Mo)
./lot1.sh    # voix, montage, MP4, contrôles, suivi.csv (≈ 1 min)
```
Sorties : `out/<id>/<id>.mp4`, `.srt`, `timeline.json`, `planche.png` (aperçu), `voice.wav`.

## Un JSON = une vidéo (`videos/HT-….json`)
- `scenes[]` : `screen` (nom d'une capture du site) ou `cta`, `title` (texte en haut), `from`/`to` = [x, y, largeur]
  du zoom dans l'écran (888 px de large), `highlight` [x,y,l,h] optionnel, `footnote`, `lines[]` = voix off.
  `*mot*` met un mot en couleur. Chaque ligne = un sous-titre.
- `voice.length_scale` : < 1 = plus rapide. `presenter.clip` : voir plus bas.
- Durée = somme des lignes ; cible 20–30 s (alerte sinon).

## Fournir sa propre voix
Aujourd'hui le moteur utilise Piper. Pour une voix humaine ou un autre outil : enregistrer chaque ligne de
`out/<id>/timeline.json` (un WAV par ligne) et me les fournir ; le moteur lira ces fichiers au lieu de Piper
(adaptation courte, non faite). ElevenLabs et Higgsfield sont connectés mais **payants : non utilisés sans votre accord**.

## Format présentateur IA
Non produit : aucun clip fourni. Marche à suivre : générer un clip vertical lip-sync (HeyGen, Higgsfield, etc.)
à partir de `out/<id>/voice.wav` (même voix, même durée), le déposer dans ce dossier, puis ajouter
`"presenter": {"clip": "presentateur.mp4"}` au JSON. Le moteur l'incruste en bas à gauche (340 px, testé avec
un clip factice). Pour un présentateur plein cadre, il faut un second gabarit (non fait).

## Licences
Voix Piper siwis : jeu de données SIWIS, licence à **vérifier avant publication** (CC BY 4.0 : mentionner le crédit
si requis). Polices Bricolage Grotesque : OFL. Captures et photo du cheval : issues du site HorseTrack ;
confirmer que vous détenez les droits de la photo du cheval et de la personne visible.
