import * as SecureStore from "expo-secure-store";
import { withKeyLock } from "@/lib/keyLock";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { initialNudgeState, recordPaywallSeen, type NudgeState } from "./premiumNudgeLogic";

/** État de la relance Premium (cf. ./premiumNudgeLogic.ts), séparé du
 * composant pour que PaywallView puisse le mettre à jour sans importer les
 * stores de l'Accueil. */
export const NUDGE_KEY = "premium_nudge_v1";

export function readNudgeState(raw: string | null, now: Date): NudgeState {
  return raw ? safeJsonParse<NudgeState>(raw, initialNudgeState(now)) : initialNudgeState(now);
}

/** À appeler à chaque affichage d'un paywall (cf. PaywallView) : la relance
 * se tait quelques jours après, pour ne jamais s'empiler sur un autre. */
export function notePaywallSeen(): void {
  withKeyLock(NUDGE_KEY, async () => {
    const now = new Date();
    const state = readNudgeState(await SecureStore.getItemAsync(NUDGE_KEY), now);
    await SecureStore.setItemAsync(NUDGE_KEY, JSON.stringify(recordPaywallSeen(state, now)));
  }).catch(() => {});
}
