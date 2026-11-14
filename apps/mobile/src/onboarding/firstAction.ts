/**
 * Première action de l'onboarding (cf. app/(onboarding)/first-action.tsx) :
 * le cavalier note tout de suite le prochain soin OU la prochaine séance de
 * son cheval, en quelques touchers. Logique pure, testable sans runtime natif.
 *
 * Rien n'est écrit pendant l'onboarding : le choix vit dans le brouillon
 * (cf. draftPersistence.ts) et devient un vrai rendez-vous ou une vraie séance
 * à la fin du parcours, une fois le cheval créé et envoyé au serveur (cf.
 * (onboarding)/paywall.tsx).
 */
import type { AppointmentType } from "@/agenda/store";
import type { ActivityType } from "@/agenda/activityKinds";
import type { Discipline } from "./store";

/** Soins proposés, du plus fréquent au moins fréquent. */
export const FIRST_CARE_TYPES = ["marechal", "vaccination", "veto", "dentiste", "osteo", "vermifuge"] as const satisfies readonly AppointmentType[];
export type FirstCareType = (typeof FIRST_CARE_TYPES)[number];

/** Dates rapides d'un soin : jamais « demain », dont le rappel de la veille
 * serait déjà passé. */
export const CARE_DATE_PRESETS = ["in_1_week", "in_2_weeks", "in_1_month", "in_2_months"] as const;
/** Dates rapides d'une séance. */
export const SESSION_DATE_PRESETS = ["today", "tomorrow", "in_2_days"] as const;
export type DatePreset = (typeof CARE_DATE_PRESETS)[number] | (typeof SESSION_DATE_PRESETS)[number];

/** Séances proposées. */
export const FIRST_SESSION_ACTIVITIES = ["dressage", "cso", "balade", "longe", "travail_a_pied", "endurance"] as const satisfies readonly ActivityType[];
export type FirstSessionActivity = (typeof FIRST_SESSION_ACTIVITIES)[number];

export type FirstActionDraft =
  | { kind: "care"; careType: FirstCareType; day: string; reminder: boolean }
  | { kind: "session"; activity: FirstSessionActivity; day: string };

/** Heure du soin quand on ne la connaît pas : le rappel « la veille » part
 * alors la veille à 9 h (cf. lib/notifications.ts, parseTime). */
export const FIRST_CARE_TIME = "";

/** Séance la plus probable d'après la discipline déclarée juste avant —
 * pré-sélection sûre, modifiable d'un toucher. */
export function defaultSessionActivity(discipline: Discipline | null): FirstSessionActivity {
  switch (discipline) {
    case "SHOW_JUMPING":
    case "HUNTER":
    case "EVENTING":
      return "cso";
    case "LEISURE":
      return "balade";
    case "ENDURANCE":
      return "endurance";
    case "ETHOLOGY":
      return "travail_a_pied";
    default:
      return "dressage";
  }
}

/** Jour local (minuit) correspondant à une date rapide. */
export function presetDate(preset: DatePreset, now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      break;
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      break;
    case "in_2_days":
      d.setDate(d.getDate() + 2);
      break;
    case "in_1_week":
      d.setDate(d.getDate() + 7);
      break;
    case "in_2_weeks":
      d.setDate(d.getDate() + 14);
      break;
    case "in_1_month":
      d.setMonth(d.getMonth() + 1);
      break;
    case "in_2_months":
      d.setMonth(d.getMonth() + 2);
      break;
  }
  return d;
}

/** « 2026-11-21 » en heure locale — jamais toISOString(), qui passe en UTC
 * et peut décaler d'un jour. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDayKey(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Relit le choix sauvegardé dans le brouillon ; null s'il est absent ou
 * incohérent (on n'invente jamais un rendez-vous). */
export function reviveFirstAction(raw: unknown): FirstActionDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== "string" || !parseDayKey(r.day)) return null;
  if (r.kind === "care" && (FIRST_CARE_TYPES as readonly string[]).includes(String(r.careType))) {
    return { kind: "care", careType: r.careType as FirstCareType, day: r.day, reminder: r.reminder === true };
  }
  if (r.kind === "session" && (FIRST_SESSION_ACTIVITIES as readonly string[]).includes(String(r.activity))) {
    return { kind: "session", activity: r.activity as FirstSessionActivity, day: r.day };
  }
  return null;
}

/** Date à utiliser à la création réelle. Un brouillon repris plus tard dont
 * la date est passée : le soin ou la séance n'est pas créé (null) plutôt que
 * daté dans le passé. */
export function firstActionDate(action: FirstActionDraft, now: Date = new Date()): Date | null {
  const d = parseDayKey(action.day);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() < today.getTime() ? null : d;
}
