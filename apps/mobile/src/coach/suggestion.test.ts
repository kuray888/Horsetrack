import { describe, expect, it } from "vitest";
import { buildConstraints } from "@/coach/constraints";
import { buildCoachFacts } from "@/coach/facts";
import { codeSuggestion, plannedSessionFromSuggestion, suggestionRequestBody } from "@/coach/suggestion";
import { baseContext } from "@/coach/eval/scenarios";

describe("suggestion calculée par le code", () => {
  it("varie : choisit le type le moins travaillé récemment", () => {
    const facts = buildCoachFacts(baseContext());
    const s = codeSuggestion(facts, buildConstraints(facts));
    expect(s.rest).toBe(false);
    expect(s.source).toBe("code");
    // Cheval de dressage : dressage hier, extérieur il y a 3 jours. Parmi les
    // trois types centraux du dressage, l'extérieur est le moins récent.
    expect(s.sessionType).toBe("SORTIE_EXTERIEURE");
  });

  it("se planifie en séance prévue, exercices en notes", () => {
    const facts = buildCoachFacts(baseContext());
    const s = codeSuggestion(facts, buildConstraints(facts));
    const planned = plannedSessionFromSuggestion(s)!;
    expect(planned.date.getDate()).toBe(28);
    expect(planned.activityType).toBe("balade");
    expect(planned.notes.split("\n").length).toBe(1 + s.exerciseIds.length);
    expect(plannedSessionFromSuggestion({ ...s, rest: true, sessionType: null })).toBeNull();
  });

  it("envoie au serveur la liste fermée des exercices et le repli", () => {
    const facts = buildCoachFacts(baseContext());
    const body = suggestionRequestBody(facts, buildConstraints(facts), "fr");
    expect(body.allowedExercises.length).toBeGreaterThan(0);
    expect(body.allowedExercises.every((e) => body.constraints.allowedTypes.includes(e.type))).toBe(true);
    expect(body.fallback.source).toBe("code");
  });
});
