import { MAX_HARD_SESSIONS_3D, MAX_WORK_DAYS_7, isHard, isWork } from "@/coach/facts";
import type { ActivityType } from "@/agenda/store";
import type { SessionIntensity, TrainingSession } from "@/sessions/store";
import { slotDuration, slotOccurrences, type RideSlot, type SlotOccurrence } from "@/planning/slots";

/**
 * Planning de la semaine (Écurie Pro v2) : séances et créneaux de tous les
 * chevaux, « Mon planning » d'un cavalier, et les contrôles — même cheval
 * réservé deux fois, cavalier à deux endroits à la fois, trop de travail,
 * pas de repos, séances éprouvantes enchaînées, cheval blessé, concours.
 * On avertit, on ne bloque jamais. Les seuils de charge sont ceux du coach
 * (coach/facts.ts). Logique pure.
 */

export type PlanItem = {
  /** Identifiant de la séance (écrite, ou à écrire pour une occurrence). */
  id: string;
  horseId: string;
  date: Date;
  time: string | null;
  durationMinutes: number | null;
  activityType: ActivityType;
  intensity: SessionIntensity | null;
  riderUserId: string | null;
  riderName: string | null;
  completed: boolean;
  /** La séance déjà écrite, ou null pour une occurrence de créneau. */
  session: TrainingSession | null;
  occurrence: SlotOccurrence | null;
};

export type PlanWarningCode =
  | "horse_overlap"
  | "rider_overlap"
  | "too_many"
  | "no_rest"
  | "hard_streak"
  | "injured"
  | "competition_day"
  | "competition_near";

export type PlanWarning = { code: PlanWarningCode; horseId: string | null; date: Date | null; itemIds: string[] };

const DEFAULT_MINUTES = 60;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

function minutesOf(time: string | null): number | null {
  const m = time ? /^(\d{1,2}):(\d{2})$/.exec(time.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Lundi de la semaine d'une date. */
export function weekStart(date: Date): Date {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** Séances de la période (hors annulées) et occurrences de créneaux pas
 * encore écrites, triées par jour puis par heure. */
export function weekPlan(sessions: TrainingSession[], slots: RideSlot[], from: Date, days = 7): PlanItem[] {
  const start = startOfDay(from);
  const end = addDays(start, days - 1);
  const items: PlanItem[] = [];
  for (const s of sessions) {
    if (!s.horseId || s.cancelledAt) continue;
    const day = startOfDay(s.date);
    if (day < start || day > end) continue;
    items.push({
      id: s.id,
      horseId: s.horseId,
      date: day,
      time: s.time.trim() || null,
      durationMinutes: s.durationMinutes,
      activityType: s.activityType,
      intensity: s.intensity,
      riderUserId: s.riderUserId ?? null,
      riderName: s.riderName ?? null,
      completed: s.completed,
      session: s,
      occurrence: null,
    });
  }
  for (const o of slotOccurrences(slots, sessions, start, end)) {
    if (o.session) continue; // déjà dans la liste des séances
    items.push({
      id: o.id,
      horseId: o.slot.horseId,
      date: o.date,
      time: o.slot.startTime,
      durationMinutes: slotDuration(o.slot.startTime, o.slot.endTime),
      activityType: o.slot.activityType ?? "dressage",
      intensity: null,
      riderUserId: o.slot.riderUserId,
      riderName: o.slot.riderName,
      completed: false,
      session: null,
      occurrence: o,
    });
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.time ?? "99").localeCompare(b.time ?? "99"));
}

/** « Mon planning » : ce qu'on m'a attribué ; et, sans cavalier attribué,
 * ce qui se passe sur mes propres chevaux. */
export function myPlan(items: PlanItem[], me: string | null, ownedHorseIds: Set<string>): PlanItem[] {
  return items.filter((i) => (i.riderUserId ? i.riderUserId === me : !i.riderName && ownedHorseIds.has(i.horseId)));
}

function overlaps(a: PlanItem, b: PlanItem): boolean {
  const sa = minutesOf(a.time);
  const sb = minutesOf(b.time);
  if (sa === null || sb === null || !sameDay(a.date, b.date)) return false;
  const ea = sa + (a.durationMinutes ?? DEFAULT_MINUTES);
  const eb = sb + (b.durationMinutes ?? DEFAULT_MINUTES);
  return sa < eb && sb < ea;
}

export type PlanContext = {
  /** Chevaux en convalescence (blessure en cours). */
  injuredHorseIds: Set<string>;
  /** Jours de concours, par cheval (premier et dernier jour inclus). */
  competitions: { horseId: string; start: Date; end: Date }[];
};

/** Contrôles de la semaine. `items` : la période entière (7 jours). */
export function planWarnings(items: PlanItem[], ctx: PlanContext): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const work = items.filter((i) => isWork(i));

  // Même cheval, créneaux qui se chevauchent ; même cavalier à deux endroits.
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!overlaps(a, b)) continue;
      if (a.horseId === b.horseId) {
        warnings.push({ code: "horse_overlap", horseId: a.horseId, date: a.date, itemIds: [a.id, b.id] });
      } else if (a.riderUserId && a.riderUserId === b.riderUserId) {
        warnings.push({ code: "rider_overlap", horseId: null, date: a.date, itemIds: [a.id, b.id] });
      }
    }
  }

  const byHorse = new Map<string, PlanItem[]>();
  for (const i of work) byHorse.set(i.horseId, [...(byHorse.get(i.horseId) ?? []), i]);
  for (const [horseId, list] of byHorse) {
    const days = new Set(list.map((i) => startOfDay(i.date).getTime()));
    if (days.size >= 7) {
      warnings.push({ code: "no_rest", horseId, date: null, itemIds: list.map((i) => i.id) });
    } else if (days.size >= MAX_WORK_DAYS_7) {
      warnings.push({ code: "too_many", horseId, date: null, itemIds: list.map((i) => i.id) });
    }
    // Séances éprouvantes rapprochées (fenêtre de 3 jours, comme le coach).
    const hard = list.filter((i) => isHard(i)).sort((a, b) => a.date.getTime() - b.date.getTime());
    for (let k = 0; k + MAX_HARD_SESSIONS_3D - 1 < hard.length; k++) {
      const group = hard.slice(k, k + MAX_HARD_SESSIONS_3D);
      const span = (startOfDay(group[group.length - 1].date).getTime() - startOfDay(group[0].date).getTime()) / 86_400_000;
      if (span <= 2) {
        warnings.push({ code: "hard_streak", horseId, date: group[group.length - 1].date, itemIds: group.map((i) => i.id) });
        break;
      }
    }
    if (ctx.injuredHorseIds.has(horseId)) {
      const planned = list.filter((i) => !i.completed);
      if (planned.length > 0) warnings.push({ code: "injured", horseId, date: null, itemIds: planned.map((i) => i.id) });
    }
  }

  // Concours : pas de travail en plus le jour même, rien d'éprouvant la
  // veille ni le lendemain (mêmes règles que le coach).
  for (const c of ctx.competitions) {
    for (const i of byHorse.get(c.horseId) ?? []) {
      const day = startOfDay(i.date).getTime();
      const from = startOfDay(c.start).getTime();
      const to = startOfDay(c.end).getTime();
      if (day >= from && day <= to) {
        warnings.push({ code: "competition_day", horseId: c.horseId, date: i.date, itemIds: [i.id] });
      } else if (isHard(i) && (day === addDays(c.start, -1).getTime() || day === addDays(c.end, 1).getTime())) {
        warnings.push({ code: "competition_near", horseId: c.horseId, date: i.date, itemIds: [i.id] });
      }
    }
  }
  return warnings;
}

/** Séances et occurrences d'un cheval pour un jour donné (case de la grille). */
export function itemsFor(items: PlanItem[], horseId: string, day: Date): PlanItem[] {
  return items.filter((i) => i.horseId === horseId && sameDay(i.date, day));
}
