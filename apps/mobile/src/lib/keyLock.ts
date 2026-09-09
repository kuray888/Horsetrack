/**
 * Sérialise les appels natifs (Keychain via expo-secure-store, SDK RevenueCat)
 * qui partagent une même clé/ressource, pour éviter deux accès concurrents à
 * la même entrée Keychain ou au même "current user" RevenueCat — suspecté
 * root cause du crash Apple Sign In (cf. audit du 2026-09-09) : SIGNED_IN
 * déclenche en fire-and-forget un `loginRevenueCat`+écriture SecureStore
 * pendant que (auth)/login.tsx vide en parallèle la même clé via `clearAll`,
 * deux appels natifs simultanés sur la même ressource plutôt qu'une simple
 * promesse non catchée (déjà exclu : chaque appelant catch déjà ses erreurs).
 * N'effectue aucune opération elle-même, ne fait que mettre en file les
 * fonctions qu'on lui passe — même résultat, juste plus jamais en parallèle.
 */
const queues = new Map<string, Promise<unknown>>();

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const settled = previous.then(fn, fn);
  queues.set(
    key,
    settled.then(
      () => {},
      () => {}
    )
  );
  return settled;
}
