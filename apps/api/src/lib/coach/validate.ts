import { containsMedicalAdvice } from "@/lib/coach/safety";
import {
  INTENSITIES,
  type CoachSuggestion,
  type QuestionOutput,
  type SuggestionOutput,
  type SuggestionRequest,
  type SummaryOutput,
} from "@/lib/coach/schemas";

/**
 * Revérification de chaque réponse du coach contre les contraintes calculées
 * par le code — logique pure, testée (validate.test.ts). Une réponse qui en
 * sort n'arrive jamais à l'app : le serveur renvoie la suggestion calculée
 * par le code (cf. engine.ts).
 */

export const REASON_MAX = 300;
export const ANSWER_MAX = 600;
export const SUMMARY_MAX = 900;

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function checkSuggestion(out: SuggestionOutput, req: SuggestionRequest): Checked<CoachSuggestion> {
  const errors: string[] = [];
  const c = req.constraints;
  const reason = out.reason.trim();
  if (reason.length < 10) errors.push("reason_empty");
  if (reason.length > REASON_MAX) errors.push("reason_too_long");
  if (containsMedicalAdvice(reason)) errors.push("medical_advice");

  if (c.restRequired && !out.rest) errors.push("rest_required");

  if (out.rest) {
    if (out.exercise_ids.length > 0) errors.push("rest_with_exercises");
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      value: {
        targetDate: req.fallback.targetDate,
        rest: true,
        sessionType: null,
        exerciseIds: [],
        durationMin: 0,
        intensity: "LOW",
        reason,
        source: "ai",
      },
    };
  }

  const type = out.session_type;
  if (type === "NONE" || !c.allowedTypes.includes(type)) errors.push("type_not_allowed");

  const byId = new Map(req.allowedExercises.map((e) => [e.id, e]));
  const ids = out.exercise_ids;
  if (ids.length < 3 || ids.length > 5) errors.push("exercise_count");
  if (new Set(ids).size !== ids.length) errors.push("exercise_duplicate");
  const picked = ids.map((id) => byId.get(id));
  if (picked.some((e) => !e)) errors.push("exercise_not_allowed");
  else {
    if (picked.some((e) => e!.type !== type)) errors.push("exercise_wrong_type");
    if (picked[0]?.phase !== "ECHAUFFEMENT") errors.push("no_warm_up_first");
    if (picked[picked.length - 1]?.phase !== "RETOUR_AU_CALME") errors.push("no_cool_down_last");
  }

  if (!Number.isInteger(out.duration_min) || out.duration_min < c.minDurationMin || out.duration_min > c.maxDurationMin) {
    errors.push("duration_out_of_bounds");
  }
  if (INTENSITIES.indexOf(out.intensity) > INTENSITIES.indexOf(c.maxIntensity)) errors.push("intensity_too_high");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      targetDate: req.fallback.targetDate,
      rest: false,
      sessionType: type as CoachSuggestion["sessionType"],
      exerciseIds: ids,
      durationMin: out.duration_min,
      intensity: out.intensity,
      reason,
      source: "ai",
    },
  };
}

export function checkAnswer(out: QuestionOutput): Checked<{ answer: string; found: boolean }> {
  const answer = out.answer.trim();
  const errors: string[] = [];
  if (out.medical_concern) errors.push("medical_concern");
  if (answer.length < 2) errors.push("answer_empty");
  if (answer.length > ANSWER_MAX) errors.push("answer_too_long");
  if (containsMedicalAdvice(answer)) errors.push("medical_advice");
  return errors.length ? { ok: false, errors } : { ok: true, value: { answer, found: out.found } };
}

export function checkSummary(out: SummaryOutput): Checked<string> {
  const summary = out.summary.trim();
  const errors: string[] = [];
  if (out.medical_concern) errors.push("medical_concern");
  if (summary.length < 40) errors.push("summary_empty");
  if (summary.length > SUMMARY_MAX) errors.push("summary_too_long");
  if (containsMedicalAdvice(summary)) errors.push("medical_advice");
  return errors.length ? { ok: false, errors } : { ok: true, value: summary };
}

/**
 * Jour de la suggestion (clé du quota « une par cheval et par jour »). La
 * date locale de l'app est gardée si elle est à un jour au plus de la date
 * UTC du serveur (fuseaux horaires) ; sinon la date du serveur : une date
 * inventée ne doit pas ouvrir un nouveau quota.
 */
export function suggestionDay(clientDay: unknown, now: Date = new Date()): string {
  const server = now.toISOString().slice(0, 10);
  if (typeof clientDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(clientDay)) return server;
  const diff = Math.abs(Date.parse(`${clientDay}T00:00:00Z`) - Date.parse(`${server}T00:00:00Z`));
  return Number.isFinite(diff) && diff <= 86_400_000 ? clientDay : server;
}
