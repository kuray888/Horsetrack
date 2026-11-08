/**
 * Logique pure des tests A/B (cf. ./experiments.ts) — séparée pour rester
 * testable avec vitest sans runtime natif, comme subscription/paywallLogic.ts.
 */

/** Hachage FNV-1a 32 bits ramené dans [0, 1) : rapide, sans dépendance, et
 * assez uniforme pour répartir des appareils entre quelques variantes. */
export function hashToUnit(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/**
 * Variante d'un appareil pour une expérience. Déterministe : même appareil,
 * même expérience → même variante à chaque lancement, sans rien stocker ni
 * appeler de serveur. La clé de l'expérience entre dans le hachage, donc deux
 * expériences ne coupent pas la population au même endroit.
 *
 * `weights` (facultatif) : parts relatives, une par variante ; égales sinon.
 * Des poids invalides (longueur différente, négatifs, somme nulle) retombent
 * sur des parts égales plutôt que de fausser silencieusement la répartition.
 */
export function pickVariant<V extends string>(
  experiment: string,
  unitId: string,
  variants: readonly [V, ...V[]],
  weights?: readonly number[]
): V {
  const valid =
    weights && weights.length === variants.length && weights.every((w) => w >= 0) && weights.some((w) => w > 0);
  const parts = valid ? weights : variants.map(() => 1);
  const total = parts.reduce((a, b) => a + b, 0);
  let point = hashToUnit(`${experiment}:${unitId}`) * total;
  for (let i = 0; i < variants.length; i++) {
    point -= parts[i];
    if (point < 0) return variants[i];
  }
  return variants[variants.length - 1];
}
