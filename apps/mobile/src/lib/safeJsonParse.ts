/**
 * `JSON.parse` qui ne plante jamais l'écran appelant : une valeur SecureStore
 * corrompue (device endommagé, stockage modifié manuellement) renvoie la
 * valeur par défaut au lieu d'une exception non rattrapée au montage du
 * Provider — cf. les stores sous src/*\/store.tsx.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
