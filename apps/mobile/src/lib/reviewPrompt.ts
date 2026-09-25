import * as SecureStore from "expo-secure-store";
import { withKeyLock } from "@/lib/keyLock";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { track } from "@/lib/analytics";
import { initialReviewState, registerPositiveMoment, type ReviewPromptState } from "./reviewPromptLogic";

const KEY = "review_prompt_v1";

export type PositiveMoment = "session_done" | "pdf_exported" | "recap_shared" | "invite_sent" | "document_added";

type StoreReviewModule = { isAvailableAsync: () => Promise<boolean>; requestReview: () => Promise<void> };

/** Chargé à la demande, jamais à l'import : `expo-store-review` est un module
 * natif, absent d'un client de dev compilé avant son ajout — un import
 * statique ferait planter l'app au démarrage au lieu de simplement ne pas
 * demander d'avis. */
function loadStoreReview(): StoreReviewModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-store-review") as StoreReviewModule;
  } catch {
    return null;
  }
}

/**
 * À appeler après un moment positif (séance cochée, export réussi, bilan
 * partagé…). Décide seul s'il est temps de demander un avis (cf.
 * reviewPromptLogic.ts) et, si oui, affiche la demande native environ 2 s après,
 * pour ne pas couper l'action en cours. Fire-and-forget, ne rejette jamais.
 */
export function recordPositiveMoment(kind: PositiveMoment): void {
  withKeyLock(KEY, async () => {
    const now = new Date();
    const raw = await SecureStore.getItemAsync(KEY);
    const state = raw ? safeJsonParse<ReviewPromptState>(raw, initialReviewState(now)) : initialReviewState(now);
    const { state: next, ask } = registerPositiveMoment(state, now);
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    return ask;
  })
    .then(async (ask) => {
      if (!ask) return;
      const StoreReview = loadStoreReview();
      if (!StoreReview || !(await StoreReview.isAvailableAsync())) return;
      track("review_prompt_requested", { trigger: kind });
      // Laisse l'action en cours se terminer (ex. carte « dis-en un mot »
      // qui suit une séance cochée) avant la demande.
      setTimeout(() => {
        StoreReview.requestReview().catch(() => {});
      }, 2500);
    })
    .catch(() => {});
}

/** Enregistre la date de première ouverture (le délai minimal avant toute
 * demande part de là). À appeler au démarrage. */
export function markFirstSeen(): void {
  withKeyLock(KEY, async () => {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) await SecureStore.setItemAsync(KEY, JSON.stringify(initialReviewState(new Date())));
  }).catch(() => {});
}
