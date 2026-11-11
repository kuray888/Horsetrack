# Données de démonstration (compte lealilou@icloud.com)

Remplit le compte avec de quoi rendre les captures pertinentes, puis le remet
dans son état d'avant (63 séances, 38 rendez-vous, 0 dépense, 0 journal).
Tout ce qui est ajouté porte un identifiant `demo_store_*`.

```bash
EMAIL=… PASSWORD=… node state.mjs     # compte les lignes (total / demo_)
EMAIL=… PASSWORD=… node seed.mjs      # ajoute (écrit demo-ids.json)
EMAIL=… PASSWORD=… node unseed.mjs    # supprime tout demo_store_*
```

Le mot de passe ne s'écrit jamais dans un fichier : variables d'environnement.

## Pièges rencontrés (2026-11-11)

- Le serveur marque le compte ACTIVE, mais RevenueCat n'a aucun achat pour lui
  (« Nothing to restore ») : sur une installation à neuf, l'app est en mode
  GRATUIT (2e cheval grisé, pas de coach). Les captures Premium exigent un
  simulateur qui garde l'état Premium déjà chargé (ne pas lancer capture.sh,
  qui efface l'app), ou un achat sandbox / un code promo Premium.
- Le coach garde UNE idée de séance par cheval et par jour, et un résumé par
  mois, dans la langue de la première demande : un jeu anglais pris le même jour
  qu'un jeu français montre du texte français. Prendre le jeu anglais un autre
  jour, ou sur un cheval sans cache (TODAY_HORSE=1 dans capture.sh).
