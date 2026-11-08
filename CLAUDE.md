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
(Next.js, admin, webhooks RevenueCat, pages légales), `apps/web` (site vitrine),
`packages/db` (Prisma/Supabase). Code, commentaires et textes en français ;
chaque texte affiché passe par `t()` (`@/i18n`) et a sa traduction dans
`src/i18n/en.ts` (un test le vérifie).

## Git

- `main` = ce qui part en build App Store. La prochaine version à publier
  (numéro dans `apps/mobile/app.json`) se prépare sur `release/<version>`,
  par petits lots sûrs ; jamais de push ni de merge sans demande explicite.
- Priorité : ce qui peut sortir maintenant sans risque. Les gros chantiers
  (refonte d'écran, onboarding réordonné) attendent la version suivante.
- Messages de commit en français, décrivant l'effet pour l'utilisateur et,
  pour un bug, sa cause.

## Conformité App Store (bloquant)

Avant toute modification du paywall, de l'achat ou du compte, vérifier :

- **3.1.2 abonnements** : nom et durée de chaque formule, prix facturé (le plus
  visible), prix après l'essai et date de début du paiement, renouvellement
  automatique et où annuler — tout lisible près du bouton d'achat.
- **Restaurer mes achats** : sur le paywall ET dans le Profil.
- **Conditions d'utilisation** (EULA) et **Politique de confidentialité** :
  liens nommés exactement ainsi (« Terms of Use », « Privacy Policy » en
  anglais), sur le paywall ET dans le Profil, via `openLegalPage()`
  (`lib/links.ts`). Les mêmes adresses doivent figurer dans App Store Connect.
- **5.1.1(v)** : suppression du compte depuis l'app (Profil > Compte).
- **4.8** : « Se connecter avec Apple » proposé dès qu'une autre connexion
  tierce (Google) l'est.
- Fermeture du paywall visible immédiatement ; sortie gratuite visible à
  l'onboarding ; aucun prix écrit en dur (prix en $ sur TestFlight : normal).
- Jamais : faux compte à rebours, fausse rareté, avis ou chiffres inventés,
  prix barré jamais pratiqué, bouton de fermeture retardé.

## Relances (Premium, retour, avis) — une seule politique

Chaque relance a sa logique pure testée et ses plafonds ; ne jamais en
ajouter une sans la placer dans ce tableau :

- Paywall contextuel : quand on touche une limite (`openPaywall(placement)`).
- Carte rappels (`RemindersUpsellCard`) : compte gratuit qui note des soins,
  14 j de silence après fermeture.
- Relance Premium périodique (`premiumNudgeLogic.ts`) : gratuit, ≥ 3 jours et
  ≥ 3 activités ; puis 7 j, 14 j, 30 j ; 3 j de silence après tout paywall ;
  une par lancement.
- Passage à l'annuel : carte Premium du Profil pour un abonné mensuel.
- Offre de retour (`WinbackCard`) : anciens abonnés, code serveur.
- Fin d'essai : rappel programmé à l'achat (`trialLifecycle.ts`).
- Retour d'inactivité (`comebackReminderLogic.ts`) : J+4 et J+11, repoussés
  à chaque ouverture, seulement si les notifications sont déjà autorisées.
- Avis App Store (`reviewPromptLogic.ts`) : ≥ 7 jours, après 3 moments
  positifs, 120 j entre deux.

## Onboarding et rétention

- Objectif : comprendre la valeur en moins de 30 s. Chaque écran doit soit
  apporter de la valeur, soit être indispensable ; sinon il est facultatif ou
  supprimé. Questions à choix : un toucher, pré-sélection quand c'est sûr.
- On mesure avant de couper : chaque écran d'onboarding envoie
  `onboarding_step_viewed` avec un `stepId` stable (`OnboardingStepId`,
  `onboarding/options.ts`) — ne jamais renommer un identifiant existant.
- Premier lancement = premier succès : après l'onboarding, l'Accueil montre
  le cheval créé et une action immédiate (première séance, premier rappel).
- Rétention J1/J7/J30 : calculée sur `app_opened` dans PostHog ; les rappels
  (séances, soins) sont le levier principal — ne jamais demander la
  permission de notification sans contexte.

## Ergonomie et placement

- Une action fréquente se fait en 2 touchers au plus depuis l'Accueil
  (« + » partagé, `QuickAddSheet`).
- Une fonctionnalité vit là où on la cherche : ce qui concerne un cheval
  dans sa fiche (`HorseHub`), le quotidien sur l'Accueil, les réglages dans
  le Profil. Un même formulaire n'existe qu'une fois (réutiliser).
- Chaque liste a un état vide qui dit quoi faire, avec le bouton pour le
  faire ; chaque chargement a un squelette (`Skeleton`), jamais un écran vide.

## Design et ressenti premium (iOS d'abord)

- **Espacement** : grille de 4/8 pt (`gap-1`, `gap-2`, `gap-3`, `gap-4`,
  `p-5`, `gap-6`, `gap-8`). Pas de nouvelles valeurs « entre-deux »
  (`gap-1.5`, `p-3.5`, `gap-2.5`) ; les existantes se corrigent quand on
  retouche l'écran.
- **Typo** : titres en `font-display` (Bricolage Grotesque), corps en police
  système. Échelle : 11 / 13 / 15 / 17 / 20 / 28 / 34. Un seul `text-3xl`
  par écran.
- **Couleurs** : jetons du thème uniquement (`bg-surface`, `text-danger`,
  `useThemeColors()`), jamais d'hexadécimal ni de `text-red-500` ; contraste
  AA vérifié par `palettes.test.ts`.
- **Chaque interaction répond** :
  - pression : `usePressScale` sur les cartes et boutons principaux
    (`PrimaryButton` le fait déjà, avec `hapticTap`) ;
  - haptique (`@/lib/haptics`) : `hapticSelection` pour un choix,
    `hapticTap` pour une action, `hapticSuccess` / `hapticError` pour un
    résultat ; jamais en continu ;
  - apparition : `FadeInView` (délais plafonnés) ; repli/dépli :
    `animateNextLayout()` ; écrans : animations natives d'expo-router
    (`slide_from_right`, `modal`) ;
  - attente : squelette ou libellé d'état (« Un instant… ») et bouton
    désactivé ; validation : `hapticSuccess` + message ou écran de réussite.
- API `Animated` native avec `useNativeDriver: true` (pas de reanimated dans
  les composants partagés : plante dans Expo Go). Durées 200–400 ms,
  `Easing.out`. Toujours respecter `prefersReducedMotion()`.
- **Anti « look IA générique »** : pas de dégradés violets, pas d'emoji
  décoratifs, pas d'ombres lourdes empilées, pas de textes vagues. On montre
  le cheval de l'utilisateur (photo, nom) dès qu'on l'a.
- Photos : `Image` de `@/components/AppImage` (cache + fondu), jamais celle
  de `react-native`.

## Analytics et tests A/B

- Événements : `track()` de `lib/analytics.ts`, typés par `AnalyticsEvent`
  (ajouter le nom à l'union avant de l'utiliser). Jamais de donnée
  personnelle (email, nom de cheval) dans les propriétés.
- Tunnel clé à préserver : `onboarding_step_viewed` → `onboarding_completed`
  → `paywall_viewed` → `paywall_plan_selected` → `paywall_cta_tapped` →
  `purchase_completed` ; plus `paywall_dismissed`, `free_tier_chosen`, et
  l'usage des fonctionnalités (`session_created`, `reminder_created`,
  `coach_question_asked`…). Toute nouvelle fonctionnalité envoie au moins un
  événement d'usage.
- Tests A/B d'interface : déclarer l'expérience dans `EXPERIMENTS`
  (`lib/experiments.ts`), lire `variant("clé")` dans le composant, livrer
  `enabled: false` puis allumer. Le témoin est toujours la première variante
  et reproduit le comportement actuel.
- Tests de prix : uniquement via RevenueCat Experiments (offres différentes) ;
  l'app lit `offerings.current` et affiche le prix du store, sans code.

## Performance

- Listes qui grandissent avec l'usage : par pages (`LIST_PAGE_SIZE`,
  `ShowMoreButton`) ou `FlatList` ; jamais un `.map()` sur toute la
  collection. Les totaux se calculent sur tout, l'affichage est paginé.
- Local d'abord : les écritures `localStore` sont synchrones, ne pas en
  ajouter dans un rendu ou une boucle. Mesures de démarrage : `startupTrace`.
- Pas de `console.log` hors `__DEV__`.

## Chasse aux bugs

1. Reproduire, puis trouver la **cause racine** avant de patcher ; l'écrire
   dans le message de commit.
2. Écrire d'abord le test qui échoue (vitest, logique pure séparée du
   composant, comme `paywallLogic.ts`), puis corriger.
3. Toujours traiter : hors ligne, store muet (prix absents), données vides,
   1 vs N chevaux, cheval partagé ou verrouillé, abonné / essai / gratuit /
   Premium offert, palettes sombres, anglais, « Réduire les animations »,
   VoiceOver (`accessibilityLabel`, `accessibilityRole`).
4. Vérifier avant de dire « fini » : `pnpm --filter @cheval/mobile test`,
   `npx tsc --noEmit` et `npx eslint <fichiers>` dans `apps/mobile`.

## Outils

- Playwright MCP : voit le site vitrine (`apps/web`) et les pages de l'API
  (`/admin`, `/cgu`, `/confidentialite`) ; l'app mobile n'a pas de build
  web, elle se vérifie sur simulateur iOS.
