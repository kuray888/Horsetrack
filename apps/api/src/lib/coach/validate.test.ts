import { describe, expect, it } from "vitest";
import { checkAnswer, checkSuggestion, checkSummary, suggestionDay } from "@/lib/coach/validate";
import { suggestionRequest } from "@/lib/coach/fixtures";

const good = {
  rest: false,
  session_type: "DRESSAGE_BASICS" as const,
  exercise_ids: ["DRESSAGE_BASICS.0.0", "DRESSAGE_BASICS.0.1", "DRESSAGE_BASICS.0.3"],
  duration_min: 45,
  intensity: "MEDIUM" as const,
  reason: "Deux séances de barres cette semaine : place au plat pour varier.",
};

describe("revérification d'une suggestion", () => {
  it("accepte une réponse dans les contraintes", () => {
    const r = checkSuggestion(good, suggestionRequest());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ sessionType: "DRESSAGE_BASICS", durationMin: 45, source: "ai" });
  });

  it("refuse un exercice inventé, d'un autre type, ou mal ordonné", () => {
    const req = suggestionRequest();
    expect(checkSuggestion({ ...good, exercise_ids: ["DRESSAGE_BASICS.0.0", "OBSTACLE.0.1", "DRESSAGE_BASICS.0.3"] }, req)).toMatchObject({
      ok: false,
      errors: ["exercise_not_allowed"],
    });
    expect(checkSuggestion({ ...good, exercise_ids: ["ASSOUPLISSEMENT.0.0", "DRESSAGE_BASICS.0.1", "DRESSAGE_BASICS.0.3"] }, req).ok).toBe(false);
    expect(checkSuggestion({ ...good, exercise_ids: ["DRESSAGE_BASICS.0.1", "DRESSAGE_BASICS.0.0", "DRESSAGE_BASICS.0.3"] }, req)).toMatchObject({
      ok: false,
      errors: ["no_warm_up_first"],
    });
  });

  it("refuse un type exclu, une durée ou une intensité hors bornes", () => {
    const req = suggestionRequest();
    expect(checkSuggestion({ ...good, session_type: "OBSTACLE" }, req).ok).toBe(false);
    expect(checkSuggestion({ ...good, duration_min: 90 }, req)).toMatchObject({ ok: false, errors: ["duration_out_of_bounds"] });
    expect(checkSuggestion({ ...good, intensity: "HIGH" }, req)).toMatchObject({ ok: false, errors: ["intensity_too_high"] });
  });

  it("impose le repos quand les contraintes l'exigent", () => {
    const req = suggestionRequest({ constraints: { ...suggestionRequest().constraints, restRequired: true, allowedTypes: [] } });
    expect(checkSuggestion(good, req).ok).toBe(false);
    const rest = checkSuggestion({ ...good, rest: true, session_type: "NONE", exercise_ids: [], duration_min: 0, intensity: "LOW" }, req);
    expect(rest.ok).toBe(true);
  });

  it("refuse une explication qui glisse un conseil médical", () => {
    expect(checkSuggestion({ ...good, reason: "Donne-lui un anti-inflammatoire avant la séance." }, suggestionRequest())).toMatchObject({
      ok: false,
      errors: ["medical_advice"],
    });
  });
});

describe("revérification d'une réponse et d'un résumé", () => {
  it("refuse une réponse médicale, vide ou trop longue", () => {
    expect(checkAnswer({ answer: "Le prochain vermifuge est le 12 novembre.", found: true, medical_concern: false }).ok).toBe(true);
    expect(checkAnswer({ answer: "Appelle le vétérinaire.", found: false, medical_concern: true }).ok).toBe(false);
    expect(checkAnswer({ answer: "x".repeat(700), found: true, medical_concern: false }).ok).toBe(false);
  });

  it("borne le résumé du mois", () => {
    expect(checkSummary({ summary: "Un mois régulier avec 12 séances, deux de plus qu'en septembre, et un premier concours.", medical_concern: false }).ok).toBe(true);
    expect(checkSummary({ summary: "Court.", medical_concern: false }).ok).toBe(false);
  });
});

describe("jour de la suggestion (quota)", () => {
  const now = new Date("2026-10-28T23:30:00Z");
  it("garde la date locale de l'app à un jour près (fuseaux horaires)", () => {
    expect(suggestionDay("2026-10-29", now)).toBe("2026-10-29");
    expect(suggestionDay("2026-10-27", now)).toBe("2026-10-27");
  });
  it("ignore une date inventée ou invalide", () => {
    expect(suggestionDay("2026-11-05", now)).toBe("2026-10-28");
    expect(suggestionDay("2026-13-45", now)).toBe("2026-10-28");
    expect(suggestionDay(undefined, now)).toBe("2026-10-28");
  });
});
