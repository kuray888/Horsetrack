import { supabase } from "@/lib/supabase";
import { hasCoachConsent, loadCoachConsent } from "@/coach/consent";
import type { CoachSuggestion } from "@/coach/suggestion";
import type { MonthFacts, RecordsFacts } from "@/coach/facts";

/**
 * Appels au coach, côté app (cf. apps/api /api/coach/*). L'IA n'est jamais
 * appelée d'ici : seulement l'API Horsetrack, qui garde la clé, les quotas
 * et l'interrupteur d'arrêt.
 */

export type CoachStatus = { available: boolean; premium: boolean; questionsLeft: number; questionsLimit: number };

/** Pas d'accord pour l'IA : rien n'a été envoyé (cf. coach/consent.ts). */
const NO_CONSENT = Symbol("no-consent");

/** `/status` ne transmet aucune donnée du cheval : il peut être lu sans accord.
 * Tout le reste envoie le carnet à l'IA et exige l'accord de l'utilisateur. */
async function call(path: string, init: RequestInit = {}): Promise<Response | null | typeof NO_CONSENT> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    if (path !== "/status") {
      await loadCoachConsent();
      if (!hasCoachConsent(data.session?.user.id)) return NO_CONSENT;
    }
    return await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/coach${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch {
    return null;
  }
}

async function json<T>(res: Response | null | typeof NO_CONSENT): Promise<T | null> {
  if (!res || res === NO_CONSENT) return null;
  return ((await res.json().catch(() => null)) as T | null) ?? null;
}

export async function fetchCoachStatus(): Promise<CoachStatus | null> {
  const res = await call("/status");
  return res && res !== NO_CONSENT && res.ok ? json<CoachStatus>(res) : null;
}

/** status : ok (réponse du coach ou repli), unavailable (coach en pause),
 * quota, premium, network. La suggestion est toujours présente sauf
 * « premium » et « network ». */
export type SuggestionResponse = {
  status: "ok" | "unavailable" | "quota" | "premium" | "network" | "consent";
  suggestion: CoachSuggestion | null;
};

export async function requestSuggestion(body: unknown): Promise<SuggestionResponse> {
  const res = await call("/suggestion", { method: "POST", body: JSON.stringify(body) });
  if (res === NO_CONSENT) return { status: "consent", suggestion: null };
  if (!res) return { status: "network", suggestion: null };
  if (res.status === 403) return { status: "premium", suggestion: null };
  const data = await json<{ status: SuggestionResponse["status"]; suggestion: CoachSuggestion }>(res);
  if (!data) return { status: "network", suggestion: null };
  return { status: data.status, suggestion: data.suggestion ?? null };
}

export type AnswerResponse =
  | { status: "ok"; answer: string; found: boolean; medical: boolean; questionsLeft?: number }
  | { status: "unavailable" | "quota" | "premium" | "network" | "error" | "consent" };

export async function askCoach(lang: "fr" | "en", question: string, records: RecordsFacts): Promise<AnswerResponse> {
  const res = await call("/question", { method: "POST", body: JSON.stringify({ lang, question, records }) });
  if (res === NO_CONSENT) return { status: "consent" };
  if (!res) return { status: "network" };
  if (res.status === 403) return { status: "premium" };
  if (res.status === 429) return { status: "quota" };
  // Requête refusée (400, 404…) ou panne du serveur : ce n'est pas un
  // problème de connexion, l'app ne doit pas dire « Pas de connexion ».
  if (!res.ok) return { status: "error" };
  const data = await json<AnswerResponse>(res);
  return data ?? { status: "network" };
}

export type SummaryStatus = "NONE" | "PENDING" | "SUBMITTED" | "DONE" | "FAILED" | "unavailable" | "quota" | "premium" | "network" | "consent";

export async function requestMonthSummary(
  horseId: string,
  month: string,
  lang: "fr" | "en",
  facts: MonthFacts
): Promise<{ status: SummaryStatus; summary: string | null }> {
  const res = await call("/summary", { method: "POST", body: JSON.stringify({ horseId, month, lang, facts }) });
  if (res === NO_CONSENT) return { status: "consent", summary: null };
  if (!res) return { status: "network", summary: null };
  if (res.status === 403) return { status: "premium", summary: null };
  const data = await json<{ status: SummaryStatus; summary: string | null }>(res);
  return data ?? { status: "network", summary: null };
}
