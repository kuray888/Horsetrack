import { supabase } from "@/lib/supabase";
import type { CoachSuggestion } from "@/coach/suggestion";
import type { MonthFacts, RecordsFacts } from "@/coach/facts";

/**
 * Appels au coach, côté app (cf. apps/api /api/coach/*). L'IA n'est jamais
 * appelée d'ici : seulement l'API Horsetrack, qui garde la clé, les quotas
 * et l'interrupteur d'arrêt.
 */

export type CoachStatus = { available: boolean; premium: boolean; questionsLeft: number; questionsLimit: number };

async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/coach${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch {
    return null;
  }
}

async function json<T>(res: Response | null): Promise<T | null> {
  if (!res) return null;
  return ((await res.json().catch(() => null)) as T | null) ?? null;
}

export async function fetchCoachStatus(): Promise<CoachStatus | null> {
  const res = await call("/status");
  return res?.ok ? json<CoachStatus>(res) : null;
}

/** status : ok (réponse du coach ou repli), unavailable (coach en pause),
 * quota, premium, network. La suggestion est toujours présente sauf
 * « premium » et « network ». */
export type SuggestionResponse = {
  status: "ok" | "unavailable" | "quota" | "premium" | "network";
  suggestion: CoachSuggestion | null;
};

export async function requestSuggestion(body: unknown): Promise<SuggestionResponse> {
  const res = await call("/suggestion", { method: "POST", body: JSON.stringify(body) });
  if (!res) return { status: "network", suggestion: null };
  if (res.status === 403) return { status: "premium", suggestion: null };
  const data = await json<{ status: SuggestionResponse["status"]; suggestion: CoachSuggestion }>(res);
  if (!data) return { status: "network", suggestion: null };
  return { status: data.status, suggestion: data.suggestion ?? null };
}

export type AnswerResponse =
  | { status: "ok"; answer: string; found: boolean; medical: boolean; questionsLeft?: number }
  | { status: "unavailable" | "quota" | "premium" | "network" };

export async function askCoach(lang: "fr" | "en", question: string, records: RecordsFacts): Promise<AnswerResponse> {
  const res = await call("/question", { method: "POST", body: JSON.stringify({ lang, question, records }) });
  if (!res) return { status: "network" };
  if (res.status === 403) return { status: "premium" };
  if (res.status === 429) return { status: "quota" };
  const data = await json<AnswerResponse>(res);
  return data ?? { status: "network" };
}

export type SummaryStatus = "NONE" | "PENDING" | "SUBMITTED" | "DONE" | "FAILED" | "unavailable" | "quota" | "premium" | "network";

export async function requestMonthSummary(
  horseId: string,
  month: string,
  lang: "fr" | "en",
  facts: MonthFacts
): Promise<{ status: SummaryStatus; summary: string | null }> {
  const res = await call("/summary", { method: "POST", body: JSON.stringify({ horseId, month, lang, facts }) });
  if (!res) return { status: "network", summary: null };
  if (res.status === 403) return { status: "premium", summary: null };
  const data = await json<{ status: SummaryStatus; summary: string | null }>(res);
  return data ?? { status: "network", summary: null };
}
