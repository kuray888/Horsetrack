import { supabase } from "@/lib/supabase";

/** Parrainage, côté app — règles et récompense : apps/api/src/lib/referrals.ts. */

export type ReferralInfo = {
  code: string;
  invited: number;
  rewarded: number;
  referredBy: string | null;
  canClaim: boolean;
};

export type ClaimResult = "ok" | "invalid" | "own_code" | "too_old" | "already_referred" | "already_subscriber" | "network";

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch {
    return null;
  }
}

export async function fetchReferral(): Promise<ReferralInfo | null> {
  const res = await authedFetch("/api/referral");
  if (!res?.ok) return null;
  return ((await res.json().catch(() => null)) as ReferralInfo | null) ?? null;
}

export async function claimReferralCode(code: string): Promise<ClaimResult> {
  const res = await authedFetch("/api/referral/claim", { method: "POST", body: JSON.stringify({ code }) });
  if (!res) return "network";
  const json = (await res.json().catch(() => null)) as { result?: ClaimResult } | null;
  return json?.result ?? "invalid";
}
