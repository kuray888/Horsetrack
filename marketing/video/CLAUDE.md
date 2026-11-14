# Vidéos TikTok / Instagram — règles

Chaîne locale : JSON -> `build.py` (Piper + Pillow + FFmpeg) -> MP4 1080×1920. Voir README.md.
Les règles du dépôt (`/CLAUDE.md`) s'appliquent : français, conformité App Store, aucune fausse promesse.

- Aucune fonctionnalité, prix, avis ou chiffre inventé : tout vient des écrans (`apps/web/src/assets/screens`),
  de `docs/fiche-app-store-1.2.0.md` et `docs/contenu-1.3.0.md`. Séance en direct = GRATUITE (jamais l'inverse).
- Un angle = une cible, un problème, un bénéfice, un seul appel à l'action (« Lien en bio »).
- Sous-titres : 1 ligne de voix = 1 sous-titre (synchro exacte). Zone sûre : texte entre y 130 et 1535.
- Pas de musique sans droits. Rien n'est publié par nous : la publication est faite à la main.
- Identifiant `HT-AAAA-MM-<angle><n>` obligatoire ; une ligne par vidéo dans `suivi.csv`.
- Un nouveau lot = de nouveaux JSON dans `videos/`, puis `./lot1.sh` ; ne pas dupliquer le moteur.
- Contrôles : `verify.py` (auto) + relecture de `out/<id>/planche.png` ; état dans `etat.md`.
