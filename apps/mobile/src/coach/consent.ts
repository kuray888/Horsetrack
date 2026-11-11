import { readJson, writeJson } from "@/lib/localStore";

/**
 * Accord de l'utilisateur pour envoyer le carnet de son cheval au prestataire
 * d'intelligence artificielle du coach (Anthropic, aux États-Unis).
 *
 * Règle 5.1.2(i) de l'App Store : informer, puis obtenir un accord explicite
 * AVANT tout envoi de données personnelles à une IA tierce. Avant, la carte du
 * coach envoyait le carnet dès l'ouverture de l'Accueil pour un compte Premium
 * (cf. audit du 2026-11-11).
 *
 * Un accord par COMPTE (un autre compte sur le même téléphone redemande), gardé
 * sur l'appareil, retirable à tout moment. Aucun accord = aucune requête :
 * coachApi.ts refuse d'envoyer, quel que soit l'écran appelant.
 */

const KEY = "coach_consent_v1";

/** Identifiant du compte → moment de l'accord (ms). */
type Stored = Record<string, number>;

let cache: Stored | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Abonnement aux changements d'accord (cf. useCoachConsent.ts). */
export function subscribeToCoachConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function isStored(value: unknown): value is Stored {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function loadCoachConsent(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!loading) {
    loading = readJson<unknown>(KEY, {}).then((stored) => {
      // Un fichier illisible ou d'une autre forme ne vaut jamais un accord.
      cache = isStored(stored) ? { ...stored } : {};
    });
  }
  return loading;
}

/** Accord donné par ce compte ? Faux tant que le fichier n'est pas lu. */
export function hasCoachConsent(userId: string | null | undefined): boolean {
  return !!userId && !!cache && typeof cache[userId] === "number";
}

export async function setCoachConsent(userId: string, granted: boolean): Promise<void> {
  await loadCoachConsent();
  const next: Stored = { ...(cache ?? {}) };
  if (granted) next[userId] = Date.now();
  else delete next[userId];
  cache = next;
  for (const listener of listeners) listener();
  await writeJson(KEY, next);
}

/** Suppression du compte / données de l'appareil : plus aucun accord retenu. */
export async function clearCoachConsent(): Promise<void> {
  cache = {};
  loading = null;
  for (const listener of listeners) listener();
  await writeJson(KEY, {});
}

/** Tests uniquement : simule un redémarrage. */
export function __resetCoachConsentForTests(): void {
  cache = null;
  loading = null;
}
