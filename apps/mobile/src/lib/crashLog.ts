import * as SecureStore from "expo-secure-store";

/**
 * Filet de diagnostic minimal en l'absence de Sentry configuré (cf.
 * app/_layout.tsx : EXPO_PUBLIC_SENTRY_DSN n'a jamais été renseigné dans
 * aucun build jusqu'ici — chaque crash TestFlight jusqu'à présent, y compris
 * celui de fin d'onboarding du 2026-09-11, n'a laissé aucune trace
 * exploitable). Persiste le dernier plantage JS (fatal ou rendu) en local,
 * relu et affiché une fois au lancement suivant (cf. LastCrashNotice) —
 * suffisant pour qu'un testeur puisse au moins nous en communiquer le
 * contenu par capture d'écran, en attendant une vraie clé Sentry.
 */
const KEY = "last_crash_v1";

export type CrashRecord = {
  message: string;
  stack: string | null;
  isFatal: boolean;
  at: string;
};

export async function recordCrash(error: unknown, isFatal: boolean): Promise<void> {
  try {
    const record: CrashRecord = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
      isFatal,
      at: new Date().toISOString(),
    };
    await SecureStore.setItemAsync(KEY, JSON.stringify(record));
  } catch {
    // Best-effort : ne doit jamais elle-même faire échouer la gestion
    // d'erreur globale qui l'appelle.
  }
}

export async function getLastCrash(): Promise<CrashRecord | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as CrashRecord) : null;
  } catch {
    return null;
  }
}

export async function clearLastCrash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Best-effort.
  }
}

/**
 * À appeler une seule fois, tôt (cf. app/_layout.tsx) — capture les erreurs
 * fatales qui échappent à Sentry.ErrorBoundary (celui-ci n'attrape que les
 * exceptions de RENDU React ; une exception dans un callback, un timer, ou
 * une continuation de promesse asynchrone passe par ce handler global à la
 * place). Rappelle toujours le handler précédent (celui de Sentry si
 * configuré, ou celui par défaut de React Native qui affiche l'écran rouge
 * en dev / relance l'app en release) : ce module ne doit jamais réduire le
 * comportement existant, seulement y ajouter la persistance locale.
 */
export function installGlobalErrorHandler(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (error: unknown, isFatal?: boolean) => void; setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void };
  };
  if (!g.ErrorUtils) return;
  const previousHandler = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    recordCrash(error, !!isFatal).finally(() => previousHandler(error, isFatal));
  });
}
