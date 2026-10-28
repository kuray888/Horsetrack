import { describe, expect, it } from "vitest";
import { buildCoachFacts, buildMonthFacts, buildRecordsFacts, consecutiveWorkDays, pickTargetDay } from "@/coach/facts";
import { EVAL_NOW, baseContext } from "@/coach/eval/scenarios";

const day = (offset: number) => new Date(2026, 9, 28 + offset);

describe("faits envoyés au coach", () => {
  it("n'envoient aucune donnée d'identité ni texte libre", () => {
    const ctx = baseContext({
      appointments: [{ type: "concours", date: day(5), nextDueDate: null, result: "2e sur 40, bravo Éclair" }],
    });
    const json = JSON.stringify([buildCoachFacts(ctx), buildRecordsFacts(ctx), buildMonthFacts(ctx, 2026, 9)]);
    expect(json).not.toMatch(/Éclair|bravo|SIRE|transpondeur|@/);
    // Le résultat d'un concours n'est transmis que comme « renseigné ».
    expect(buildRecordsFacts(ctx).appointments[0].resultEntered).toBe(true);
  });

  it("calcule la charge de la semaine", () => {
    const facts = buildCoachFacts(baseContext());
    expect(facts.load.sessionsDone7d).toBe(3);
    expect(facts.load.restDays7d).toBe(4);
    expect(facts.load.consecutiveWorkDays).toBe(1);
  });

  it("compte les jours de travail d'affilée, aujourd'hui compris", () => {
    const sessions = [0, -1, -2].map((o) => ({ date: day(o), activityType: "dressage" as const, durationMinutes: 40, intensity: null, completed: true }));
    expect(consecutiveWorkDays(sessions, EVAL_NOW)).toBe(3);
  });

  it("vise le premier jour libre, hors demi-pension", () => {
    expect(pickTargetDay(baseContext()).getDate()).toBe(28);
    expect(pickTargetDay(baseContext({ partnerDays: [3, 4] })).getDate()).toBe(30);
    const busy = baseContext({
      sessions: [{ date: day(0), activityType: "dressage", durationMinutes: 40, intensity: null, completed: false }],
    });
    expect(pickTargetDay(busy).getDate()).toBe(29);
    expect(pickTargetDay(baseContext({ now: new Date(2026, 9, 28, 21) })).getDate()).toBe(29);
  });

  it("résume les parcours GPS sans le tracé", () => {
    const ctx = baseContext({
      sessions: [
        {
          date: day(-1),
          activityType: "balade",
          durationMinutes: 60,
          intensity: "low",
          completed: true,
          ride: { gps: true, distanceMeters: 12_340, trotSeconds: 900, canterSeconds: 300, durationSeconds: 3600 },
        },
      ],
    });
    expect(buildCoachFacts(ctx).last28Days[0].gps).toEqual({ km: 12.3, trotMin: 15, canterMin: 5 });
  });

  it("additionne les dépenses par mois et catégorie", () => {
    const ctx = baseContext({
      expenses: [
        { date: day(-3), category: "marechal", amount: 90 },
        { date: day(-2), category: "marechal", amount: 95.5 },
      ],
    });
    expect(buildRecordsFacts(ctx).expensesByMonth).toEqual([{ month: "2026-10", category: "marechal", total: 185.5, count: 2 }]);
  });
});
