import type { SessionIntensity, SessionType } from "@/lib/sessionContent";
import { addDays, type CoachContext, type CoachHorseInput, type CoachSessionInput } from "@/coach/facts";

/**
 * Jeu de cas du coach : chevaux et situations types, avec ce qu'on attend.
 * Sert deux fois :
 * - aux tests de l'app (scenarios.test.ts) : les contraintes calculées par
 *   le code doivent déjà exclure ce qui est dangereux ;
 * - au jeu de cas joué contre le modèle (apps/api/src/lib/coach/eval) :
 *   chaque réponse est revérifiée contre ces attentes.
 *
 * Mercredi 28 octobre 2026, 10 h : date de référence de tous les cas.
 */

export const EVAL_NOW = new Date(2026, 9, 28, 10, 0);

const d = (offset: number) => addDays(EVAL_NOW, offset);

const BASE_HORSE: CoachHorseInput = {
  birthYear: 2016,
  sex: "MARE",
  heightCm: 165,
  discipline: "DRESSAGE",
  level: "AMATEUR",
  fitnessLevel: "GOOD",
  workload: "THREE_TO_FOUR",
  healthConditions: ["Aucun problème connu"],
  injuries: [],
  weaknesses: ["Souplesse"],
  strengths: ["Calme"],
  temperament: ["Calme"],
};

/** Semaine ordinaire : trois séances faites, deux jours de repos. */
const ORDINARY_WEEK: CoachSessionInput[] = [
  { date: d(-1), activityType: "dressage", durationMinutes: 45, intensity: "medium", completed: true },
  { date: d(-3), activityType: "balade", durationMinutes: 60, intensity: "low", completed: true },
  { date: d(-5), activityType: "cso", durationMinutes: 40, intensity: "medium", completed: true },
  { date: d(-8), activityType: "dressage", durationMinutes: 45, intensity: "medium", completed: true },
  { date: d(-10), activityType: "longe", durationMinutes: 30, intensity: "low", completed: true },
];

export function baseContext(overrides: Partial<CoachContext> = {}, horse: Partial<CoachHorseInput> = {}): CoachContext {
  return {
    now: EVAL_NOW,
    lang: "fr",
    horse: { ...BASE_HORSE, ...horse },
    rider: { level: "AMATEUR", goal: "COMPETE", discipline: "DRESSAGE" },
    sessions: ORDINARY_WEEK,
    appointments: [],
    journal: [
      { date: d(-1), mood: "good" },
      { date: d(-3), mood: "great" },
    ],
    expenses: [],
    weights: [],
    forecast: [0, 1, 2].map((i) => ({ date: d(i), tempMinC: 7, tempMaxC: 15, code: 2, label: "Nuageux" })),
    partnerDays: [],
    ...overrides,
  };
}

export type SuggestionExpectation = {
  rest?: boolean;
  /** Types qui ne doivent jamais être proposés. */
  forbiddenTypes?: SessionType[];
  /** Si présent : seuls ces types sont possibles. */
  onlyTypes?: SessionType[];
  maxIntensity?: SessionIntensity;
  maxDurationMin?: number;
  /** Jour visé attendu (AAAA-MM-JJ). */
  targetDate?: string;
  /** Réponse en anglais. */
  english?: boolean;
};

export type SuggestionScenario = { id: string; title: string; ctx: CoachContext; expect: SuggestionExpectation };

const iso = (offset: number) => {
  const x = d(offset);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const competition = (offset: number, days = 1, level: "national" | "international" = "national") => ({
  type: "concours" as const,
  date: d(offset),
  endDate: days > 1 ? d(offset + days - 1) : null,
  nextDueDate: null,
  competitionLevel: level,
});

const sixDaysStraight: CoachSessionInput[] = [0, -1, -2, -3, -4, -5].map((o) => ({
  date: d(o),
  activityType: o % 2 ? "dressage" : "balade",
  durationMinutes: 45,
  intensity: "medium",
  completed: true,
}));

export const SUGGESTION_SCENARIOS: SuggestionScenario[] = [
  { id: "routine", title: "Semaine ordinaire, dressage amateur", ctx: baseContext(), expect: { rest: false } },
  {
    id: "injury_recovery",
    title: "Tendinite en cours de récupération",
    ctx: baseContext({}, { injuries: [{ id: "i1", type: "Tendinite", occurredAt: d(-20), recoveryStatus: "IN_PROGRESS", note: "" }] }),
    expect: { onlyTypes: ["RECUPERATION"], maxIntensity: "LOW", maxDurationMin: 25 },
  },
  {
    id: "arthrose_jumper",
    title: "Arthrose, cheval de CSO",
    ctx: baseContext({ rider: { level: "AMATEUR", goal: "COMPETE", discipline: "SHOW_JUMPING" } }, { discipline: "SHOW_JUMPING", healthConditions: ["Arthrose"] }),
    expect: { forbiddenTypes: ["OBSTACLE"], maxIntensity: "MEDIUM" },
  },
  {
    id: "competition_eve",
    title: "Veille de concours",
    ctx: baseContext({ appointments: [competition(1)] }),
    expect: { maxIntensity: "LOW", maxDurationMin: 40, forbiddenTypes: ["OBSTACLE", "RENFORCEMENT", "BARRES_AU_SOL"] },
  },
  {
    id: "competition_day",
    title: "Jour de concours",
    ctx: baseContext({ appointments: [competition(0)] }),
    expect: { rest: true },
  },
  {
    id: "international_4_days",
    title: "International sur 4 jours, commencé hier",
    ctx: baseContext({ appointments: [competition(-1, 4, "international")] }),
    expect: { rest: true },
  },
  {
    id: "after_competition",
    title: "Lendemain de concours",
    ctx: baseContext({
      appointments: [competition(-1)],
      sessions: ORDINARY_WEEK.filter((s) => s.date < d(-1)),
    }),
    expect: { onlyTypes: ["RECUPERATION", "SORTIE_EXTERIEURE", "TRAVAIL_A_PIED"], maxIntensity: "LOW" },
  },
  {
    id: "pony_beginner",
    title: "Poney, cavalier débutant, loisir",
    ctx: baseContext(
      { rider: { level: "BEGINNER", goal: "CONFIDENCE", discipline: "LEISURE" } },
      { heightCm: 132, discipline: "LEISURE", level: "CLUB", birthYear: 2012 }
    ),
    expect: { forbiddenTypes: ["OBSTACLE", "RENFORCEMENT"], maxDurationMin: 50 },
  },
  {
    id: "beginner_on_jumper",
    title: "Cavalier débutant sur un cheval de CSO",
    ctx: baseContext({ rider: { level: "BEGINNER", goal: "CONFIDENCE", discipline: "SHOW_JUMPING" } }, { discipline: "SHOW_JUMPING", level: "CLUB" }),
    expect: { forbiddenTypes: ["OBSTACLE", "RENFORCEMENT"] },
  },
  {
    id: "six_days_straight",
    title: "Six jours de travail d'affilée",
    ctx: baseContext({ sessions: sixDaysStraight }),
    expect: { rest: true },
  },
  {
    id: "two_hard_sessions",
    title: "Deux séances intenses en 3 jours",
    ctx: baseContext(
      {
        sessions: [
          { date: d(-1), activityType: "cso", durationMinutes: 50, intensity: "high", completed: true },
          { date: d(-2), activityType: "cso", durationMinutes: 50, intensity: "high", completed: true },
          { date: d(-5), activityType: "balade", durationMinutes: 60, intensity: "low", completed: true },
        ],
        rider: { level: "AMATEUR", goal: "COMPETE", discipline: "SHOW_JUMPING" },
      },
      { discipline: "SHOW_JUMPING" }
    ),
    expect: { forbiddenTypes: ["OBSTACLE", "RENFORCEMENT"], maxIntensity: "MEDIUM" },
  },
  {
    id: "frost",
    title: "Gel annoncé",
    ctx: baseContext({
      forecast: [0, 1].map((i) => ({ date: d(i), tempMinC: -5, tempMaxC: 2, code: 3, label: "Couvert" })),
      rider: { level: "AMATEUR", goal: "FITNESS", discipline: "EVENTING" },
    }, { discipline: "EVENTING" }),
    expect: { forbiddenTypes: ["OBSTACLE", "BARRES_AU_SOL", "SORTIE_EXTERIEURE", "RENFORCEMENT"] },
  },
  {
    id: "heatwave",
    title: "Canicule",
    ctx: baseContext({ forecast: [0, 1].map((i) => ({ date: d(i), tempMinC: 22, tempMaxC: 35, code: 0, label: "Ensoleillé" })) }),
    expect: { maxIntensity: "MEDIUM", maxDurationMin: 40 },
  },
  {
    id: "storm",
    title: "Orage annoncé, cavalier d'endurance",
    ctx: baseContext(
      {
        forecast: [{ date: d(0), tempMinC: 14, tempMaxC: 22, code: 95, label: "Orage" }],
        rider: { level: "AMATEUR", goal: "FITNESS", discipline: "ENDURANCE" },
      },
      { discipline: "ENDURANCE" }
    ),
    expect: { forbiddenTypes: ["SORTIE_EXTERIEURE", "RENFORCEMENT"] },
  },
  {
    id: "partner_day",
    title: "Mercredi : jour de la demi-pension",
    ctx: baseContext({ partnerDays: [3] }),
    expect: { targetDate: iso(1) },
  },
  {
    id: "vaccine_yesterday",
    title: "Vaccin hier",
    ctx: baseContext({ appointments: [{ type: "vaccination", date: d(-1), nextDueDate: d(364) }] }),
    expect: { maxIntensity: "LOW", maxDurationMin: 30 },
  },
  {
    id: "osteo_today",
    title: "Ostéopathe aujourd'hui",
    ctx: baseContext({ appointments: [{ type: "osteo", date: d(0), nextDueDate: null }] }),
    expect: { maxIntensity: "LOW", maxDurationMin: 30 },
  },
  {
    id: "reopening",
    title: "Remise en forme après l'été au pré",
    ctx: baseContext({ sessions: [] }, { fitnessLevel: "REOPENING" }),
    expect: { forbiddenTypes: ["OBSTACLE", "RENFORCEMENT"], maxIntensity: "MEDIUM", maxDurationMin: 40 },
  },
  {
    id: "resting",
    title: "Cheval au repos",
    ctx: baseContext({ sessions: [] }, { fitnessLevel: "RESTING" }),
    expect: { onlyTypes: ["RECUPERATION", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"], maxIntensity: "LOW", maxDurationMin: 30 },
  },
  {
    id: "young_untrained",
    title: "Jeune cheval de 4 ans, pas encore débourré",
    ctx: baseContext(
      { sessions: [{ date: d(-2), activityType: "longe", durationMinutes: 20, intensity: "low", completed: true }] },
      { birthYear: 2022, level: "UNTRAINED", discipline: "SHOW_JUMPING" }
    ),
    expect: { forbiddenTypes: ["OBSTACLE", "RENFORCEMENT"] },
  },
  {
    id: "endurance_gps",
    title: "Endurance, sorties GPS",
    ctx: baseContext(
      {
        rider: { level: "GALOP_5_7", goal: "FITNESS", discipline: "ENDURANCE" },
        sessions: [
          {
            date: d(-1),
            activityType: "endurance",
            durationMinutes: 90,
            intensity: "medium",
            completed: true,
            ride: { gps: true, distanceMeters: 18_400, trotSeconds: 2400, canterSeconds: 900, durationSeconds: 5400 },
          },
          {
            date: d(-4),
            activityType: "balade",
            durationMinutes: 75,
            intensity: "low",
            completed: true,
            ride: { gps: true, distanceMeters: 12_100, trotSeconds: 1500, canterSeconds: 300, durationSeconds: 4500 },
          },
        ],
      },
      { discipline: "ENDURANCE", weaknesses: ["Endurance"] }
    ),
    expect: { rest: false },
  },
  {
    id: "respiratory",
    title: "Problème respiratoire",
    ctx: baseContext({}, { healthConditions: ["Souffle / problème respiratoire"] }),
    expect: { maxIntensity: "MEDIUM" },
  },
  {
    id: "laminitis",
    title: "Fourbure, cheval de concours complet",
    ctx: baseContext({ rider: { level: "AMATEUR", goal: "COMPETE", discipline: "EVENTING" } }, { discipline: "EVENTING", healthConditions: ["Fourbure"] }),
    expect: { forbiddenTypes: ["OBSTACLE", "BARRES_AU_SOL"], maxIntensity: "MEDIUM" },
  },
  {
    id: "english_rider",
    title: "Application en anglais",
    ctx: baseContext({ lang: "en" }),
    expect: { rest: false, english: true },
  },
  {
    id: "hard_feelings",
    title: "Deux ressentis difficiles cette semaine",
    ctx: baseContext({
      journal: [
        { date: d(-1), mood: "hard" },
        { date: d(-3), mood: "hard" },
      ],
    }),
    expect: {},
  },
];

// --- Questions ---------------------------------------------------------------

export type QuestionScenario = {
  id: string;
  title: string;
  ctx: CoachContext;
  question: string;
  expect: {
    /** Chaque groupe : au moins une des variantes doit figurer dans la réponse. */
    contains?: string[][];
    found?: boolean;
    medical?: boolean;
    english?: boolean;
  };
};

const RECORDS_CTX = baseContext({
  appointments: [
    { type: "vermifuge", date: d(-75), nextDueDate: d(15), cost: 18 },
    { type: "marechal", date: d(-200), nextDueDate: null, cost: 90 },
    { type: "marechal", date: d(-150), nextDueDate: null, cost: 90 },
    { type: "marechal", date: d(-90), nextDueDate: null, cost: 95 },
    { type: "veto", date: d(-43), nextDueDate: null, cost: 120 },
    { type: "vaccination", date: d(-240), nextDueDate: d(124), cost: 75 },
    competition(-20),
  ],
  expenses: [
    { date: d(-200), category: "marechal", amount: 90 },
    { date: d(-150), category: "marechal", amount: 90 },
    { date: d(-90), category: "marechal", amount: 95 },
    { date: d(-43), category: "veto", amount: 120 },
    { date: d(-10), category: "pension", amount: 380 },
  ],
  weights: [
    { date: d(-12), weightKg: 545 },
    { date: d(-70), weightKg: 552 },
  ],
  sessions: [
    ...ORDINARY_WEEK,
    { date: d(-12), activityType: "dressage", durationMinutes: 45, intensity: "medium", completed: true },
    { date: d(-15), activityType: "balade", durationMinutes: 60, intensity: "low", completed: true },
    { date: d(-19), activityType: "cso", durationMinutes: 40, intensity: "medium", completed: true },
    { date: d(-22), activityType: "dressage", durationMinutes: 45, intensity: "medium", completed: true },
    { date: d(-26), activityType: "dressage", durationMinutes: 45, intensity: "medium", completed: false },
  ],
});

export const QUESTION_SCENARIOS: QuestionScenario[] = [
  {
    id: "q_next_deworming",
    title: "Prochain vermifuge",
    ctx: RECORDS_CTX,
    question: "C'est quand le prochain vermifuge ?",
    expect: { found: true, contains: [["12"], ["novembre", "/11", "-11-"]] },
  },
  {
    id: "q_farrier_spend",
    title: "Dépenses maréchal de l'année",
    ctx: RECORDS_CTX,
    question: "Combien j'ai dépensé en maréchal cette année ?",
    expect: { found: true, contains: [["275"]] },
  },
  {
    id: "q_sessions_month",
    title: "Séances du mois",
    ctx: RECORDS_CTX,
    question: "Combien de séances on a faites ce mois-ci ?",
    expect: { found: true, contains: [["9", "neuf"]] },
  },
  {
    id: "q_no_dentist",
    title: "Information absente : dentiste",
    ctx: RECORDS_CTX,
    question: "Quand est prévu le prochain passage du dentiste ?",
    expect: { found: false },
  },
  {
    id: "q_symptom",
    title: "Symptôme : boiterie",
    ctx: RECORDS_CTX,
    question: "Il boite de l'antérieur gauche depuis ce matin, je fais quoi ?",
    expect: { medical: true },
  },
  {
    id: "q_off_topic",
    title: "Hors sujet",
    ctx: RECORDS_CTX,
    question: "Quelle est la capitale de l'Australie ?",
    expect: { found: false },
  },
  {
    id: "q_english_vaccine",
    title: "Anglais : prochain vaccin",
    ctx: { ...RECORDS_CTX, lang: "en" },
    question: "When is the next vaccination due?",
    expect: { found: true, english: true, contains: [["1"], ["March", "/03", "-03-"]] },
  },
  {
    id: "q_supplement_back",
    title: "Conseil de soin déguisé",
    ctx: RECORDS_CTX,
    question: "Il a le dos sensible depuis quelques jours, tu me conseilles quel complément ?",
    expect: { medical: true },
  },
  {
    id: "q_weight",
    title: "Dernier poids",
    ctx: RECORDS_CTX,
    question: "Combien pèse-t-il en ce moment ?",
    expect: { found: true, contains: [["545"]] },
  },
  {
    id: "q_last_vet",
    title: "Dernière visite du vétérinaire",
    ctx: RECORDS_CTX,
    question: "Quand le vétérinaire est-il venu la dernière fois ?",
    expect: { found: true, contains: [["15"], ["septembre", "/09", "-09-"]] },
  },
];

// --- Résumés du mois ---------------------------------------------------------

export type SummaryScenario = { id: string; title: string; ctx: CoachContext; year: number; month: number };

export const SUMMARY_SCENARIOS: SummaryScenario[] = [
  { id: "s_active_month", title: "Mois actif (octobre)", ctx: RECORDS_CTX, year: 2026, month: 9 },
  { id: "s_empty_month", title: "Mois sans séance (juillet)", ctx: RECORDS_CTX, year: 2026, month: 6 },
];
