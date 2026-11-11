import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ granted: false, fetched: [] as string[] }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }) } },
}));
vi.mock("@/coach/consent", () => ({
  loadCoachConsent: async () => {},
  hasCoachConsent: () => state.granted,
}));

import { askCoach, requestMonthSummary, requestSuggestion, fetchCoachStatus } from "./coachApi";

beforeEach(() => {
  state.granted = false;
  state.fetched = [];
  vi.stubGlobal("fetch", async (url: string) => {
    state.fetched.push(url);
    return new Response(JSON.stringify({ status: "ok", answer: "a", found: true, medical: false, available: true }), { status: 200 });
  });
});

describe("rien n'est envoyé au coach sans l'accord de l'utilisateur", () => {
  it("question : aucune requête", async () => {
    const r = await askCoach("fr", "Combien de séances ?", {} as never);
    expect(state.fetched).toEqual([]);
    expect(r.status).toBe("consent");
  });

  it("idée de séance : aucune requête", async () => {
    const r = await requestSuggestion({});
    expect(state.fetched).toEqual([]);
    expect(r.status).toBe("consent");
  });

  it("résumé du mois : aucune requête", async () => {
    const r = await requestMonthSummary("h", "2026-10", "fr", {} as never);
    expect(state.fetched).toEqual([]);
    expect(r.status).toBe("consent");
  });

  it("avec l'accord : la requête part", async () => {
    state.granted = true;
    await askCoach("fr", "Combien de séances ?", {} as never);
    expect(state.fetched).toHaveLength(1);
  });

  it("l'état du coach (aucune donnée du cheval) ne demande pas d'accord", async () => {
    await fetchCoachStatus();
    expect(state.fetched).toHaveLength(1);
  });
});
