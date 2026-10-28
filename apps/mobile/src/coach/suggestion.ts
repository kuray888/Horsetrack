import { SESSION_META, type SessionIntensity, type SessionType } from "@/lib/sessionContent";
import { SESSION_TYPE_INFO, exerciseById, intensityAtMost } from "@/coach/exerciseLibrary";
import { allowedExercises, clampDuration, type AllowedExercise, type CoachConstraints } from "@/coach/constraints";
import type { CoachFacts } from "@/coach/facts";
import type { ActivityType } from "@/agenda/activityKinds";
import type { Discipline } from "@/onboarding/store";
import { t } from "@/i18n";

/**
 * « Ta prochaine séance » : la suggestion calculée par le code. C'est elle
 * que voit un compte gratuit, et celle que le serveur renvoie quand la
 * réponse du coach ne respecte pas les contraintes. Logique pure, testée.
 */

export type CoachSuggestion = {
  targetDate: string;
  rest: boolean;
  sessionType: SessionType | null;
  exerciseIds: string[];
  durationMin: number;
  intensity: SessionIntensity;
  /** Une ou deux phrases. */
  reason: string;
  /** "ai" : choisie et expliquée par le coach ; "code" : calculée ici. */
  source: "ai" | "code";
};

/** Séances du planning → type de la bibliothèque le plus proche. */
const TYPES_OF_ACTIVITY: Partial<Record<ActivityType, SessionType[]>> = {
  dressage: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT"],
  cso: ["BARRES_AU_SOL", "OBSTACLE"],
  cross: ["OBSTACLE"],
  balade: ["SORTIE_EXTERIEURE"],
  endurance: ["RENFORCEMENT", "SORTIE_EXTERIEURE"],
  trec: ["SORTIE_EXTERIEURE"],
  longe: ["TRAVAIL_A_PIED"],
  travail_a_pied: ["TRAVAIL_A_PIED"],
  liberte: ["TRAVAIL_A_PIED"],
};

/** Jours depuis la dernière séance faite de ce type (99 si jamais). */
function daysSince(type: SessionType, facts: CoachFacts): number {
  const hit = facts.last28Days.find((s) => s.done && (TYPES_OF_ACTIVITY[s.activity] ?? []).includes(type));
  return hit ? hit.daysAgo : 99;
}

/** Types de séance propres à chaque discipline, du plus central au moins
 * central. La variété se joue entre les trois premiers autorisés : un
 * cheval de dressage ne reçoit pas du travail en côte parce qu'il n'en a
 * « jamais fait ». */
const DISCIPLINE_PREFERENCE: Record<Discipline, SessionType[]> = {
  DRESSAGE: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "SORTIE_EXTERIEURE", "BARRES_AU_SOL", "TRAVAIL_A_PIED", "RENFORCEMENT"],
  SHOW_JUMPING: ["BARRES_AU_SOL", "OBSTACLE", "DRESSAGE_BASICS", "ASSOUPLISSEMENT", "SORTIE_EXTERIEURE", "RENFORCEMENT"],
  HUNTER: ["BARRES_AU_SOL", "OBSTACLE", "DRESSAGE_BASICS", "ASSOUPLISSEMENT", "SORTIE_EXTERIEURE"],
  EVENTING: ["DRESSAGE_BASICS", "BARRES_AU_SOL", "OBSTACLE", "RENFORCEMENT", "SORTIE_EXTERIEURE", "ASSOUPLISSEMENT"],
  ENDURANCE: ["SORTIE_EXTERIEURE", "RENFORCEMENT", "ASSOUPLISSEMENT", "DRESSAGE_BASICS", "TRAVAIL_A_PIED"],
  LEISURE: ["SORTIE_EXTERIEURE", "ASSOUPLISSEMENT", "DRESSAGE_BASICS", "TRAVAIL_A_PIED", "BARRES_AU_SOL"],
  ETHOLOGY: ["TRAVAIL_A_PIED", "SORTIE_EXTERIEURE", "ASSOUPLISSEMENT", "DRESSAGE_BASICS"],
  WESTERN: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "SORTIE_EXTERIEURE", "TRAVAIL_A_PIED", "RENFORCEMENT"],
  ATTELAGE: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE", "RENFORCEMENT"],
};

function restReason(constraints: CoachConstraints): string {
  return constraints.rules.find((r) => ["competition_day", "load_rest", "nothing_allowed"].includes(r.code))?.text ?? t("Journée de repos.");
}

export function codeSuggestion(facts: CoachFacts, constraints: CoachConstraints): CoachSuggestion {
  const base = { targetDate: facts.targetDay.date, source: "code" as const };
  if (constraints.restRequired || constraints.allowedTypes.length === 0) {
    return { ...base, rest: true, sessionType: null, exerciseIds: [], durationMin: 0, intensity: "LOW", reason: restReason(constraints) };
  }
  // Parmi les trois types les plus propres à la discipline encore autorisés,
  // le moins travaillé récemment. Récupération seulement s'il ne reste rien.
  const preference = DISCIPLINE_PREFERENCE[facts.horse.discipline as Discipline] ?? DISCIPLINE_PREFERENCE.LEISURE;
  const ranked = [...preference, ...constraints.allowedTypes].filter(
    (ty, i, all) => all.indexOf(ty) === i && constraints.allowedTypes.includes(ty) && ty !== "RECUPERATION"
  );
  const candidates = ranked.length ? ranked.slice(0, 3) : constraints.allowedTypes;
  const type = [...candidates].sort(
    (a, b) => daysSince(b, facts) - daysSince(a, facts) || candidates.indexOf(a) - candidates.indexOf(b)
  )[0];

  // Variante qui tourne avec le nombre de séances de ce type déjà faites.
  const doneOfType = facts.last28Days.filter((s) => s.done && (TYPES_OF_ACTIVITY[s.activity] ?? []).includes(type)).length;
  const variants = SESSION_META[type].exerciseVariants;
  const v = doneOfType % variants.length;
  const exerciseIds = variants[v].map((_, i) => `${type}.${v}.${i}`);

  const typeIntensity = SESSION_TYPE_INFO[type].intensity;
  const intensity = intensityAtMost(typeIntensity, constraints.maxIntensity) ? typeIntensity : constraints.maxIntensity;
  const since = daysSince(type, facts);
  const reason =
    since >= 99
      ? t("{title} : pas travaillé ces quatre dernières semaines.", { title: SESSION_META[type].title })
      : t("{title} : le moins travaillé ces derniers jours (il y a {days} j).", { title: SESSION_META[type].title, days: since });
  const ruleNote = constraints.rules[0]?.text;

  return {
    ...base,
    rest: false,
    sessionType: type,
    exerciseIds,
    durationMin: clampDuration(type, constraints),
    intensity,
    reason: ruleNote ? `${reason} ${ruleNote}` : reason,
  };
}

/** Ce que le serveur reçoit pour vérifier la réponse du coach. */
export function suggestionRequestBody(facts: CoachFacts, constraints: CoachConstraints, lang: "fr" | "en") {
  const allowed: AllowedExercise[] = allowedExercises(constraints);
  return {
    lang,
    facts,
    constraints: {
      restRequired: constraints.restRequired,
      allowedTypes: constraints.allowedTypes,
      maxIntensity: constraints.maxIntensity,
      minDurationMin: constraints.minDurationMin,
      maxDurationMin: constraints.maxDurationMin,
      rules: constraints.rules.map((r) => r.text),
    },
    allowedExercises: allowed,
    fallback: codeSuggestion(facts, constraints),
  };
}

/** « Planifier » : la séance prévue créée à partir de la suggestion. */
export function plannedSessionFromSuggestion(s: CoachSuggestion): {
  date: Date;
  activityType: ActivityType;
  durationMinutes: number;
  intensity: "low" | "medium" | "high";
  notes: string;
} | null {
  if (s.rest || !s.sessionType) return null;
  const [y, m, d] = s.targetDate.split("-").map(Number);
  const lines = s.exerciseIds
    .map((id) => exerciseById(id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => `• ${e.title.replace(/\*\*/g, "")}`);
  return {
    date: new Date(y, m - 1, d),
    activityType: SESSION_TYPE_INFO[s.sessionType].activity,
    durationMinutes: s.durationMin,
    intensity: s.intensity.toLowerCase() as "low" | "medium" | "high",
    notes: [t("Proposée par le coach : {reason}", { reason: s.reason }), ...lines].join("\n"),
  };
}
