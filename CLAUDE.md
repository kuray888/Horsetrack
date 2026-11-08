<!-- rtk-instructions v2 -->
# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk proxy <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.
<!-- /rtk-instructions -->

# Horsetrack — règles de travail

Monorepo pnpm + turbo : `apps/mobile` (Expo, expo-router, NativeWind), `apps/api`
(Next.js, admin, webhooks RevenueCat), `apps/web` (site vitrine), `packages/db`
(Prisma/Supabase). Code, commentaires et textes en français ; chaque texte
affiché passe par `t()` (`@/i18n`).

## Git

- `main` = ce qui part en build App Store. La prochaine version à publier
  (numéro dans `apps/mobile/app.json`) se prépare sur `release/<version>`,
  par petits lots sûrs ; jamais de push ni de merge sans demande explicite.
- Priorité : ce qui peut sortir maintenant sans risque. Les gros chantiers
  (refonte d'écran, onboarding raccourci) attendent la version suivante.
- Messages de commit en français, à l'impératif, décrivant l'effet pour
  l'utilisateur (cf. historique).

## Design (iOS d'abord)

- **Espacement** : grille de 4/8 pt. Préférer les pas 2, 4, 8, 12, 16, 20, 24,
  32 (`gap-1`, `gap-2`, `gap-3`, `gap-4`, `p-5`, `gap-6`, `gap-8`). Pas de
  nouvelles valeurs « entre-deux » (`gap-1.5`, `p-3.5`, `gap-2.5`) ; les
  existantes se corrigent quand on retouche l'écran, pas en masse.
- **Typo** : titres en `font-display` (Bricolage Grotesque), corps en police
  système. Échelle limitée : 11 / 13 / 15 / 17 / 20 / 28 / 34. Un seul titre
  `text-3xl` par écran. Pas de `text-[NNpx]` hors de cette échelle.
- **Couleurs** : uniquement les jetons du thème (`bg-surface`, `text-muted`,
  `useThemeColors()`), jamais d'hexadécimal en dur — chaque palette doit
  rester juste en clair et en sombre (`palettes.test.ts` vérifie le contraste).
- **Mouvement** : `FadeInView` (apparition), `usePressScale` (pression),
  `animateNextLayout()` (repli/dépli), haptique via `@/lib/haptics`. API
  `Animated` native avec `useNativeDriver: true` ; pas de reanimated dans ces
  composants partagés (plante dans Expo Go). Toujours respecter
  `prefersReducedMotion()`. Durées 200–320 ms, décélération (`Easing.out`).
- **Anti « look IA générique »** : pas de dégradés violets, pas d'emoji
  décoratifs, pas de cartes à ombre lourde empilées, pas de textes vagues
  (« Boostez votre expérience »). On montre le cheval de l'utilisateur
  (photo, nom) plutôt qu'une icône générique dès qu'on l'a.
- Images : toujours `Image` de `@/components/AppImage` (expo-image, cache +
  fondu), jamais `Image` de `react-native` pour une photo.

## Paywall et conversion

- Les prix affichés viennent **toujours** du store (RevenueCat). Aucun prix
  écrit en dur ni calculé à la main ; `FALLBACK_PRICE` ne s'affiche pas. Prix
  en $ sur TestFlight : normal, ne pas « corriger ».
- Règle App Store 3.1.2 : le montant facturé est l'élément de prix le plus
  visible ; l'équivalent mensuel reste secondaire ; durée de l'essai et prix
  après l'essai lisibles à côté du bouton ; « Restaurer », Conditions et
  Confidentialité toujours présents ; fermeture visible.
- Leviers autorisés : annuel présélectionné et mis en avant, ancrage sur le
  prix mensuel réel du store, titre contextuel (`paywallCopy` par
  `placement`), personnalisation (nom/photo du cheval), frise d'essai,
  réassurance (« Aucun paiement aujourd'hui » seulement si l'essai est
  confirmé par le store).
- Interdits : faux compte à rebours, fausse rareté, avis ou chiffres
  inventés, prix barré qui n'a jamais été pratiqué, bouton de fermeture
  retardé ou caché, sortie gratuite masquée à l'onboarding.
- Toute modification du paywall garde les événements `track()` existants
  (`paywall_viewed`, `paywall_plan_selected`, `paywall_cta_tapped`,
  `paywall_dismissed`, `free_tier_chosen`) : c'est le tunnel PostHog.
- Onboarding : chaque écran doit mériter sa place ; mesurer avant de couper.

## Performance

- Listes qui grandissent avec l'usage (journal, séances, dépenses, documents) :
  pagination (cf. `JOURNAL_PAGE_SIZE`) ou `FlatList` ; jamais un `.map()` sur
  toute la collection dans un `ScrollView`.
- Délais d'apparition plafonnés (`MAX_FADE_DELAY_MS`).
- Local d'abord : les écritures `localStore` sont synchrones, ne pas en
  ajouter dans un rendu ou une boucle. Mesures de démarrage : `startupTrace`.
- Pas de `console.log` hors `__DEV__`.

## Chasse aux bugs

1. Reproduire, puis trouver la **cause racine** (pas le symptôme) avant de
   patcher ; l'expliquer dans le message de commit.
2. Écrire d'abord le test qui échoue (vitest, logique pure séparée du
   composant comme `paywallLogic.ts`), puis corriger.
3. Toujours traiter : hors ligne / réseau coupé, store muet (prix absents),
   données vides, 1 vs N chevaux, cheval partagé ou verrouillé, abonné /
   essai / gratuit / Premium offert, palettes sombres, « Réduire les
   animations », VoiceOver (`accessibilityLabel`, `accessibilityRole`).
4. Vérifier : `pnpm --filter @cheval/mobile test` et `tsc --noEmit` dans
   `apps/mobile` avant de dire que c'est fini.

## Outils

- Playwright MCP : voit le site vitrine (`apps/web`) et les pages de l'API
  (`/admin`, `/cgu`) ; l'app mobile n'a pas de build web, elle se vérifie sur
  simulateur iOS.
