import type { SuggestionRequest } from "@/lib/coach/schemas";

/** Requête type pour les tests du serveur. */
export function suggestionRequest(overrides: Partial<SuggestionRequest> = {}): SuggestionRequest {
  return {
    horseId: "h1",
    lang: "fr",
    facts: { today: "2026-10-28", targetDay: { date: "2026-10-28", weekday: "wednesday", inDays: 0 } },
    constraints: {
      restRequired: false,
      allowedTypes: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT"],
      maxIntensity: "MEDIUM",
      minDurationMin: 20,
      maxDurationMin: 60,
      rules: [],
    },
    allowedExercises: [
      { id: "DRESSAGE_BASICS.0.0", type: "DRESSAGE_BASICS", phase: "ECHAUFFEMENT", title: "Échauffement" },
      { id: "DRESSAGE_BASICS.0.1", type: "DRESSAGE_BASICS", phase: "CORPS_DE_SEANCE", title: "Transitions" },
      { id: "DRESSAGE_BASICS.0.2", type: "DRESSAGE_BASICS", phase: "CORPS_DE_SEANCE", title: "Voltes" },
      { id: "DRESSAGE_BASICS.0.3", type: "DRESSAGE_BASICS", phase: "RETOUR_AU_CALME", title: "Pas" },
      { id: "ASSOUPLISSEMENT.0.0", type: "ASSOUPLISSEMENT", phase: "ECHAUFFEMENT", title: "Étirements" },
    ],
    fallback: {
      targetDate: "2026-10-28",
      rest: false,
      sessionType: "ASSOUPLISSEMENT",
      exerciseIds: ["ASSOUPLISSEMENT.0.0"],
      durationMin: 45,
      intensity: "LOW",
      reason: "Séance calculée par le code.",
      source: "code",
    },
    ...overrides,
  };
}
