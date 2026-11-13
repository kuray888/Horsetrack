# Améliorations proposées après la 1.3.0 (classées, effet fort / risque faible)

Aucune n'est faite dans la 1.3.0 : pas de nouveau code sans revue sur simulateur juste avant la soumission.

1. **Mise à jour d'Expo / React Native** (dépendances d'outils signalées par `pnpm audit`, dont
   `shell-quote`) : sécurité des outils de build, aucun effet pour l'utilisateur. Risque moyen → 1.3.x dédiée.
2. **Limite de débit durable** sur `/api/promo/redeem`, `/api/public-ride`, `/api/weather` : règle Vercel
   (sans code) en premier, table en base si l'usage monte.
3. **Relance des liens publics non supprimés hors ligne** : file de suppressions à rejouer au prochain
   lancement (aujourd'hui le lien reste jusqu'à la prochaine suppression ou celle du compte).
4. **Avertissements `console.warn` hors `__DEV__`** (≈ 15 dans l'app, sans donnée personnelle) :
   les passer derrière `__DEV__` pour respecter la règle du projet.
5. **Déplacer `pnpm.overrides`** vers `pnpm-workspace.yaml` (pnpm ne le lit plus) et remonter
   `postcss` / `sharp` / `deepmerge-ts` avec la prochaine montée de Next / Prisma.
