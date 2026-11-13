import { timingSafeEqual } from "node:crypto";

/**
 * Comparaison d'un en-tête `Authorization: Bearer <secret>` au secret attendu,
 * en temps constant (webhook RevenueCat, crons). Faux si le secret n'est pas
 * configuré : une variable manquante ne doit jamais ouvrir la route.
 */
export function secretMatches(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Limite de débit en mémoire de l'instance : freine un essai en rafale (devinette
 * de codes promo) sans table ni service. Une instance neuve repart de zéro ;
 * c'est un garde-fou, pas un pare-feu — la limite de Vercel (WAF) reste à régler.
 */
export function createRateLimiter(opts: { max: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  return function allow(key: string): boolean {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < opts.windowMs);
    if (recent.length >= opts.max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= opts.windowMs)) hits.delete(k);
    return true;
  };
}
