import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { setSuperProperty, track } from "@/lib/analytics";
import { pickVariant } from "@/lib/experimentsLogic";

/**
 * Tests A/B d'interface (textes, mises en page, ordre des écrans), sans SDK :
 * la variante est tirée sur l'appareil (cf. pickVariant), puis
 *   - `experiment_exposed` est envoyé la première fois qu'elle est lue ;
 *   - chaque événement suivant porte `$feature/<clé>` = variante, la
 *     propriété que PostHog Experiments lit pour comparer les tunnels.
 *
 * Les PRIX ne se testent pas ici : Apple facture le produit acheté, et le
 * paywall affiche toujours le prix du store. Un test de prix se monte dans
 * RevenueCat Experiments (offres différentes servies à chaque moitié), que
 * l'app suit déjà sans mise à jour puisqu'elle lit `offerings.current`.
 *
 * Usage : déclarer l'expérience dans EXPERIMENTS, puis
 * `const v = variant("paywall_cta")` dans le composant. Une expérience
 * `enabled: false` renvoie toujours sa première variante (le témoin) et
 * n'envoie rien — on livre le code éteint, on l'allume dans une version.
 */
type ExperimentDef = {
  variants: readonly [string, ...string[]];
  /** Parts relatives, une par variante ; égales si absent. */
  weights?: readonly number[];
  enabled: boolean;
};

export const EXPERIMENTS = {
  // Exemple — à copier pour une vraie expérience :
  // paywall_cta: { variants: ["control", "trial_first"], enabled: false },
} as const satisfies Record<string, ExperimentDef>;

export type ExperimentKey = keyof typeof EXPERIMENTS;
type Variant<K extends ExperimentKey> = (typeof EXPERIMENTS)[K]["variants"][number];

/** Identifiant d'appareil propre aux expériences, jamais effacé à la
 * déconnexion (contrairement à l'anonyme analytics) : un cavalier qui
 * crée son compte au milieu de l'onboarding garde sa variante. */
const UNIT_KEY = "experiment_unit_v1";
let unitId: string | null = null;
const exposed = new Set<string>();

function getUnitId(): string {
  if (unitId) return unitId;
  try {
    unitId = SecureStore.getItem(UNIT_KEY);
    if (!unitId) {
      unitId = Crypto.randomUUID();
      SecureStore.setItem(UNIT_KEY, unitId);
    }
  } catch {
    // Trousseau indisponible : variante stable pour cette session seulement.
    unitId = unitId ?? Crypto.randomUUID();
  }
  return unitId;
}

/** Variante de cet appareil pour l'expérience `key` (lecture synchrone,
 * utilisable directement dans un rendu). */
export function variant<K extends ExperimentKey>(key: K): Variant<K> {
  const def: ExperimentDef = EXPERIMENTS[key];
  if (!def.enabled) return def.variants[0] as Variant<K>;
  const v = pickVariant(key, getUnitId(), def.variants, def.weights);
  if (!exposed.has(key)) {
    exposed.add(key);
    setSuperProperty(`$feature/${key}`, v);
    track("experiment_exposed", { experiment: key, variant: v });
  }
  return v as Variant<K>;
}
