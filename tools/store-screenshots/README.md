# Visuels App Store

Fabrique les captures d'écran de la fiche App Store (6,9", 1290 × 2796), en
français et en anglais, en **3 jeux** pour les tests de page produit d'Apple
(Product Page Optimization).

## 1. Captures brutes (simulateur)

1. Démarrer un simulateur **iPhone 16 ou 17 Pro Max**, langue française, avec
   un build de Horsetrack installé (`eas build --profile simulator`).
2. Préparer un **compte de démonstration** Premium, rempli comme un vrai
   cavalier : un cheval principal avec photo, des séances cette semaine, des
   soins à venir (vaccin, maréchal), quelques dépenses, souvenirs avec photos,
   une demi-pension. Jamais le compte d'un vrai client.
3. Lancer :
   ```bash
   EMAIL=demo@… PASSWORD=… HORSE="Tornade" ./capture.sh fr
   ```
4. Repasser le simulateur en anglais, puis `./capture.sh en`.

Les images arrivent dans `raw/fr/` et `raw/en/` (today, hub, sante, budget,
partage, planning, journal, coach). Une capture ratée se refait à la main
(⌘S dans le simulateur) et se dépose sous le même nom.

## 2. Mise en page

```bash
npm run setup    # une fois : Playwright + Chromium
npm run render
open out/index.html
```

Résultat : `out/<langue>/<jeu>/01-….png` … `08-….png`.

## 3. Dans App Store Connect

- **Page par défaut** : jeu `soins` (le besoin le plus fort : ne rien oublier).
- **Product Page Optimization** (Fonctionnalités → Optimisation de la page
  produit) : créer un test avec les traitements `coach` et `ecurie`, 33 % du
  trafic chacun, au moins 2 à 4 semaines. Garder le gagnant comme page par
  défaut.
- Textes et ordre : `screens.mjs`. Les trois premiers visuels comptent le plus
  (ce que l'on voit sans faire défiler dans les résultats de recherche).
