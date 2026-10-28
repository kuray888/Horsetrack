import { AccessibilityInfo, LayoutAnimation, Platform } from "react-native";

/**
 * Réglage iOS/Android « Réduire les animations », lu une fois puis tenu à
 * jour — lecture synchrone pour les animations qui démarrent au montage
 * (FadeInView, Skeleton), qui n'ont pas le temps d'attendre une promesse.
 */
let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotion = v;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
  reduceMotion = v;
});

export function prefersReducedMotion(): boolean {
  return reduceMotion;
}

/** Anime le prochain changement de mise en page (section qui s'ouvre, carte
 * qui se déplie, élément retiré d'une liste) au lieu d'un saut instantané.
 * À appeler juste avant le setState qui provoque le changement. Sans effet
 * si « Réduire les animations » est activé, et limité à iOS : sur Android
 * (nouvelle architecture), LayoutAnimation reste moins fiable. */
export function animateNextLayout(): void {
  if (reduceMotion || Platform.OS !== "ios") return;
  LayoutAnimation.configureNext({
    duration: 220,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
