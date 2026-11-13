import * as SecureStore from "expo-secure-store";
import { withKeyLock } from "@/lib/keyLock";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { closeReferralNudge, countPositive, initialReferralNudge, type ReferralNudgeState } from "./referralNudgeLogic";

const KEY = "referral_nudge_v1";

export async function readReferralNudge(): Promise<ReferralNudgeState> {
  const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
  return raw ? safeJsonParse<ReferralNudgeState>(raw, initialReferralNudge(new Date())) : initialReferralNudge(new Date());
}

function update(fn: (s: ReferralNudgeState) => ReferralNudgeState): Promise<ReferralNudgeState> {
  return withKeyLock(KEY, async () => {
    const next = fn(await readReferralNudge());
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    return next;
  });
}

/** Appelé à chaque moment positif (cf. lib/reviewPrompt.ts). */
export function countReferralPositiveMoment(): void {
  update(countPositive).catch(() => {});
}

export function closeReferralNudgeCard(how: "dismissed" | "opened"): void {
  update((s) => closeReferralNudge(s, new Date(), how)).catch(() => {});
}

/** Au démarrage : pose la date de première ouverture si elle manque. */
export function markReferralFirstSeen(): void {
  update((s) => s).catch(() => {});
}
