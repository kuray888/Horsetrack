import { PRICES } from "@/lib/coach/config";

/** Ce que l'API renvoie dans `usage` (champs utiles au coût). */
export type CoachUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** Coût estimé d'un appel, en dollars. `batch` : moitié prix. */
export function estimateCostUsd(usage: CoachUsage, batch = false): number {
  const cost =
    (usage.input_tokens * PRICES.input +
      usage.output_tokens * PRICES.output +
      (usage.cache_read_input_tokens ?? 0) * PRICES.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * PRICES.cacheWrite) /
    1_000_000;
  return batch ? cost / 2 : cost;
}

/** En millionièmes de dollar, pour la base (entier). */
export function toMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}
