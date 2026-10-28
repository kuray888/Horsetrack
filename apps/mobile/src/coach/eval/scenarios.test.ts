import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INTENSITY_ORDER } from "@/coach/exerciseLibrary";
import { allowedExercises, buildConstraints } from "@/coach/constraints";
import { buildCoachFacts, buildMonthFacts, buildRecordsFacts } from "@/coach/facts";
import { codeSuggestion, suggestionRequestBody } from "@/coach/suggestion";
import { QUESTION_SCENARIOS, SUGGESTION_SCENARIOS, SUMMARY_SCENARIOS } from "@/coach/eval/scenarios";

/**
 * Les règles de sécurité tiennent dès le code, avant toute IA : pour chaque
 * cas, les contraintes calculées et la suggestion de repli respectent déjà
 * ce qu'on attend. Le jeu de cas joué contre le modèle (apps/api, cf.
 * COACH_WRITE_CASES ci-dessous) part de ces mêmes calculs.
 */
describe("jeu de cas du coach : la part du code", () => {
  it("compte au moins 30 cas", () => {
    expect(SUGGESTION_SCENARIOS.length + QUESTION_SCENARIOS.length + SUMMARY_SCENARIOS.length).toBeGreaterThanOrEqual(30);
  });

  for (const sc of SUGGESTION_SCENARIOS) {
    it(`${sc.id} — ${sc.title}`, () => {
      const facts = buildCoachFacts(sc.ctx);
      const c = buildConstraints(facts);
      const e = sc.expect;
      if (e.targetDate) expect(facts.targetDay.date).toBe(e.targetDate);
      if (e.rest === true) expect(c.restRequired).toBe(true);
      if (e.rest === false) expect(c.restRequired).toBe(false);
      for (const ty of e.forbiddenTypes ?? []) expect(c.allowedTypes).not.toContain(ty);
      if (e.onlyTypes) for (const ty of c.allowedTypes) expect(e.onlyTypes).toContain(ty);
      if (e.maxIntensity) expect(INTENSITY_ORDER.indexOf(c.maxIntensity)).toBeLessThanOrEqual(INTENSITY_ORDER.indexOf(e.maxIntensity));
      if (e.maxDurationMin) expect(c.maxDurationMin).toBeLessThanOrEqual(e.maxDurationMin);

      // La suggestion du code reste dans les contraintes.
      const s = codeSuggestion(facts, c);
      const allowedIds = new Set(allowedExercises(c).map((x) => x.id));
      if (c.restRequired) expect(s.rest).toBe(true);
      else {
        expect(c.allowedTypes).toContain(s.sessionType);
        for (const id of s.exerciseIds) expect(allowedIds.has(id)).toBe(true);
        expect(s.durationMin).toBeGreaterThanOrEqual(c.minDurationMin);
        expect(s.durationMin).toBeLessThanOrEqual(c.maxDurationMin);
        expect(INTENSITY_ORDER.indexOf(s.intensity)).toBeLessThanOrEqual(INTENSITY_ORDER.indexOf(c.maxIntensity));
      }
    });
  }

  it("écrit les cas pour le jeu de test de l'API (COACH_WRITE_CASES=1)", () => {
    if (process.env.COACH_WRITE_CASES !== "1") return;
    const cases = {
      generatedAt: new Date().toISOString(),
      suggestions: SUGGESTION_SCENARIOS.map((sc) => {
        const facts = buildCoachFacts(sc.ctx);
        return {
          id: sc.id,
          title: sc.title,
          expect: sc.expect,
          request: { horseId: "eval", ...suggestionRequestBody(facts, buildConstraints(facts), sc.ctx.lang) },
        };
      }),
      questions: QUESTION_SCENARIOS.map((sc) => ({
        id: sc.id,
        title: sc.title,
        expect: sc.expect,
        request: { lang: sc.ctx.lang, question: sc.question, records: buildRecordsFacts(sc.ctx) },
      })),
      summaries: SUMMARY_SCENARIOS.map((sc) => ({
        id: sc.id,
        title: sc.title,
        lang: sc.ctx.lang,
        facts: buildMonthFacts(sc.ctx, sc.year, sc.month),
      })),
    };
    const out = path.resolve(__dirname, "../../../../api/src/lib/coach/eval/cases.json");
    writeFileSync(out, `${JSON.stringify(cases)}\n`);
  });
});
