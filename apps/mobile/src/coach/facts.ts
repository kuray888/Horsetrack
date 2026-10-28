import type { ActivityType } from "@/agenda/activityKinds";
import type { AppointmentType, CompetitionLevel, ExpenseCategory, Mood } from "@/agenda/store";
import type { Horse } from "@/horses/store";
import type { Discipline, RiderGoal, RiderLevel } from "@/onboarding/store";
import { knownHealthConditions } from "@/horses/healthConditions";

/**
 * Faits envoyés au coach (cf. apps/api/src/lib/coach) — logique pure, testée
 * (facts.test.ts). Le code rassemble et calcule ; l'IA ne fait que choisir
 * et expliquer.
 *
 * Rien qui identifie quelqu'un : ni nom (du cheval, du cavalier, de la
 * demi-pension, d'un professionnel), ni numéro (SIRE, puce, assurance), ni
 * texte libre saisi (notes, résultats, lieux). Seulement des types, des
 * dates relatives, des durées, des montants et des valeurs de listes.
 */

// --- Données d'entrée (formes minimales des stores de l'app) ---------------

export type CoachHorseInput = Pick<
  Horse,
  | "birthYear"
  | "sex"
  | "heightCm"
  | "discipline"
  | "level"
  | "fitnessLevel"
  | "workload"
  | "healthConditions"
  | "injuries"
  | "weaknesses"
  | "strengths"
  | "temperament"
>;

export type CoachSessionInput = {
  date: Date;
  activityType: ActivityType;
  durationMinutes: number | null;
  intensity: "low" | "medium" | "high" | null;
  completed: boolean;
  ride?: { gps: boolean; distanceMeters: number; trotSeconds: number; canterSeconds: number; durationSeconds: number } | null;
};

export type CoachAppointmentInput = {
  type: AppointmentType;
  date: Date;
  endDate?: Date | null;
  nextDueDate: Date | null;
  competitionLevel?: CompetitionLevel | null;
  cost?: number | null;
  /** Saisi par le cavalier : seulement « renseigné ou non » est envoyé. */
  result?: string | null;
};

export type CoachContext = {
  now: Date;
  /** "fr" | "en" : langue de l'app, celle de la réponse. */
  lang: "fr" | "en";
  horse: CoachHorseInput;
  rider: { level: RiderLevel | null; goal: RiderGoal | null; discipline: Discipline | null };
  sessions: CoachSessionInput[];
  appointments: CoachAppointmentInput[];
  journal: { date: Date; mood: Mood }[];
  expenses: { date: Date; category: ExpenseCategory; amount: number }[];
  weights: { date: Date; weightKg: number }[];
  forecast: { date: Date; tempMinC: number; tempMaxC: number; code: number; label: string }[] | null;
  /** Jours ISO (1 = lundi … 7 = dimanche) de la demi-pension. */
  partnerDays: number[];
};

// --- Dates -------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Jours calendaires de `from` à `to` (positif si `to` est après). */
export function dayDiff(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function addDays(d: Date, n: number): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

// --- Jour visé par « Ta prochaine séance » ----------------------------------

/**
 * Premier jour libre à partir d'aujourd'hui : pas une journée où une séance
 * est déjà faite ou prévue, ni un jour de la demi-pension. Après 20 h, on
 * regarde demain. Au plus une semaine devant.
 */
export function pickTargetDay(ctx: CoachContext): Date {
  const start = ctx.now.getHours() >= 20 ? 1 : 0;
  for (let i = start; i < start + 7; i++) {
    const day = addDays(ctx.now, i);
    const busy = ctx.sessions.some((s) => dayDiff(s.date, day) === 0);
    const partner = ctx.partnerDays.includes(isoWeekday(day));
    if (!busy && !partner) return day;
  }
  return addDays(ctx.now, start);
}

// --- Faits pour la suggestion ------------------------------------------------

export type CoachFacts = {
  today: string;
  targetDay: { date: string; weekday: string; inDays: number };
  horse: {
    ageYears: number | null;
    sex: string | null;
    heightCm: number | null;
    pony: boolean;
    level: string;
    discipline: string;
    fitness: string | null;
    usualWorkload: string | null;
    healthConditions: string[];
    injuriesInRecovery: { type: string; sinceDays: number | null }[];
    chronicInjuries: string[];
    weaknesses: string[];
    strengths: string[];
    temperament: string[];
  };
  rider: { level: string | null; goal: string | null; discipline: string | null };
  last28Days: {
    daysAgo: number;
    activity: ActivityType;
    durationMin: number | null;
    intensity: string | null;
    done: boolean;
    gps: { km: number; trotMin: number; canterMin: number } | null;
  }[];
  load: {
    sessionsDone7d: number;
    minutes7d: number;
    restDays7d: number;
    consecutiveWorkDays: number;
    hardSessions3d: number;
  };
  health: { upcoming: { type: AppointmentType; inDays: number }[]; recent: { type: AppointmentType; daysAgo: number }[] };
  competitions: { inDays: number; days: number; level: CompetitionLevel | null }[];
  moods14d: { daysAgo: number; mood: Mood }[];
  weather: { inDays: number; minC: number; maxC: number; code: number; label: string }[];
  partnerDays: string[];
};

/** Poney : moins de 1,49 m au garrot. */
export const PONY_MAX_HEIGHT_CM = 148;

const isHard = (s: CoachSessionInput) =>
  s.intensity === "high" || ["cso", "cross", "endurance"].includes(s.activityType) || (s.durationMinutes ?? 0) >= 75;

const isWork = (s: CoachSessionInput) => s.activityType !== "repos" && s.activityType !== "pansage";

/** Jours de travail consécutifs jusqu'à hier (séances faites). */
export function consecutiveWorkDays(sessions: CoachSessionInput[], now: Date): number {
  let n = 0;
  for (let i = 1; i <= 14; i++) {
    const day = addDays(now, -i);
    const worked = sessions.some((s) => s.completed && isWork(s) && dayDiff(s.date, day) === 0);
    if (!worked) break;
    n++;
  }
  // La séance faite aujourd'hui compte aussi.
  const today = sessions.some((s) => s.completed && isWork(s) && dayDiff(s.date, now) === 0);
  return today ? n + 1 : n;
}

export function buildCoachFacts(ctx: CoachContext, target: Date = pickTargetDay(ctx)): CoachFacts {
  const { now, horse } = ctx;
  const done = ctx.sessions.filter((s) => s.completed && isWork(s));
  const in7 = done.filter((s) => {
    const d = dayDiff(s.date, now);
    return d >= 0 && d < 7;
  });
  const workDays7 = new Set(in7.map((s) => isoDate(s.date)));

  return {
    today: isoDate(now),
    targetDay: { date: isoDate(target), weekday: WEEKDAYS[target.getDay()], inDays: dayDiff(now, target) },
    horse: {
      ageYears: horse.birthYear ? now.getFullYear() - horse.birthYear : null,
      sex: horse.sex,
      heightCm: horse.heightCm,
      pony: !!horse.heightCm && horse.heightCm <= PONY_MAX_HEIGHT_CM,
      level: horse.level,
      discipline: horse.discipline,
      fitness: horse.fitnessLevel,
      usualWorkload: horse.workload,
      healthConditions: knownHealthConditions(horse.healthConditions),
      injuriesInRecovery: horse.injuries
        .filter((i) => i.recoveryStatus === "IN_PROGRESS")
        .map((i) => ({ type: i.type, sinceDays: i.occurredAt ? dayDiff(i.occurredAt, now) : null })),
      chronicInjuries: horse.injuries.filter((i) => i.recoveryStatus === "ONGOING").map((i) => i.type),
      weaknesses: horse.weaknesses,
      strengths: horse.strengths,
      temperament: horse.temperament,
    },
    rider: { level: ctx.rider.level, goal: ctx.rider.goal, discipline: ctx.rider.discipline },
    last28Days: ctx.sessions
      .filter((s) => {
        const d = dayDiff(s.date, now);
        return d >= 0 && d < 28;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((s) => ({
        daysAgo: dayDiff(s.date, now),
        activity: s.activityType,
        durationMin: s.durationMinutes,
        intensity: s.intensity,
        done: s.completed,
        gps:
          s.ride && s.ride.gps
            ? {
                km: Math.round(s.ride.distanceMeters / 100) / 10,
                trotMin: Math.round(s.ride.trotSeconds / 60),
                canterMin: Math.round(s.ride.canterSeconds / 60),
              }
            : null,
      })),
    load: {
      sessionsDone7d: in7.length,
      minutes7d: in7.reduce((n, s) => n + (s.durationMinutes ?? 0), 0),
      restDays7d: 7 - workDays7.size,
      consecutiveWorkDays: consecutiveWorkDays(ctx.sessions, now),
      hardSessions3d: done.filter((s) => {
        const d = dayDiff(s.date, now);
        return d >= 0 && d < 3 && isHard(s);
      }).length,
    },
    health: {
      upcoming: ctx.appointments
        .flatMap((a) => {
          const dates: Date[] = [];
          if (a.type !== "concours" && dayDiff(now, a.date) >= 0) dates.push(a.date);
          if (a.nextDueDate && dayDiff(now, a.nextDueDate) >= 0) dates.push(a.nextDueDate);
          return dates.map((d) => ({ type: a.type, inDays: dayDiff(now, d) }));
        })
        .filter((h) => h.inDays <= 60)
        .sort((a, b) => a.inDays - b.inDays)
        .slice(0, 8),
      recent: ctx.appointments
        .filter((a) => a.type !== "concours" && dayDiff(a.date, now) > 0 && dayDiff(a.date, now) <= 14)
        .map((a) => ({ type: a.type, daysAgo: dayDiff(a.date, now) }))
        .sort((a, b) => a.daysAgo - b.daysAgo),
    },
    competitions: ctx.appointments
      .filter((a) => a.type === "concours")
      .map((a) => ({
        inDays: dayDiff(now, a.date),
        days: a.endDate ? Math.max(1, dayDiff(a.date, a.endDate) + 1) : 1,
        level: a.competitionLevel ?? null,
      }))
      // Concours en cours (commencé, pas fini) compris.
      .filter((c) => c.inDays + c.days - 1 >= -1 && c.inDays <= 21)
      .sort((a, b) => a.inDays - b.inDays),
    moods14d: ctx.journal
      .filter((j) => {
        const d = dayDiff(j.date, now);
        return d >= 0 && d < 14;
      })
      .map((j) => ({ daysAgo: dayDiff(j.date, now), mood: j.mood }))
      .sort((a, b) => a.daysAgo - b.daysAgo),
    weather: (ctx.forecast ?? [])
      .map((f) => ({ inDays: dayDiff(now, f.date), minC: Math.round(f.tempMinC), maxC: Math.round(f.tempMaxC), code: f.code, label: f.label }))
      .filter((f) => f.inDays >= 0 && f.inDays <= 3),
    partnerDays: [...ctx.partnerDays].sort().map((d) => WEEKDAYS[d % 7]),
  };
}

// --- Faits pour les questions ------------------------------------------------

export type RecordsFacts = {
  today: string;
  horse: {
    ageYears: number | null;
    level: string;
    discipline: string;
    healthConditions: string[];
    injuries: { type: string; status: string | null; date: string | null }[];
  };
  appointments: {
    type: AppointmentType;
    date: string;
    endDate: string | null;
    nextDue: string | null;
    cost: number | null;
    resultEntered: boolean;
  }[];
  expensesByMonth: { month: string; category: ExpenseCategory; total: number; count: number }[];
  sessionsByMonth: { month: string; done: number; planned: number; minutes: number; activities: Partial<Record<ActivityType, number>> }[];
  upcomingSessions: { date: string; activity: ActivityType; durationMin: number | null }[];
  weights: { date: string; kg: number }[];
  journalMoodsByMonth: { month: string; moods: Partial<Record<Mood, number>> }[];
};

const monthKey = (d: Date) => isoDate(d).slice(0, 7);

/**
 * Le carnet du cheval sur 13 mois (et ce qui est prévu), sous forme
 * agrégée : de quoi répondre à « prochain vermifuge ? », « dépenses maréchal
 * de l'année ? », « séances du mois ? » sans rien deviner.
 */
export function buildRecordsFacts(ctx: CoachContext): RecordsFacts {
  const { now } = ctx;
  const from = addDays(now, -396);
  const recent = <T extends { date: Date }>(list: T[]) => list.filter((x) => x.date >= from);

  const expenses = new Map<string, { month: string; category: ExpenseCategory; total: number; count: number }>();
  for (const e of recent(ctx.expenses)) {
    const k = `${monthKey(e.date)}|${e.category}`;
    const cur = expenses.get(k) ?? { month: monthKey(e.date), category: e.category, total: 0, count: 0 };
    cur.total = Math.round((cur.total + e.amount) * 100) / 100;
    cur.count++;
    expenses.set(k, cur);
  }

  const sessions = new Map<string, RecordsFacts["sessionsByMonth"][number]>();
  for (const s of recent(ctx.sessions).filter((s) => s.date <= now)) {
    const k = monthKey(s.date);
    const cur = sessions.get(k) ?? { month: k, done: 0, planned: 0, minutes: 0, activities: {} };
    if (s.completed) {
      cur.done++;
      cur.minutes += s.durationMinutes ?? 0;
      cur.activities[s.activityType] = (cur.activities[s.activityType] ?? 0) + 1;
    } else cur.planned++;
    sessions.set(k, cur);
  }

  const moods = new Map<string, Partial<Record<Mood, number>>>();
  for (const j of recent(ctx.journal)) {
    const cur = moods.get(monthKey(j.date)) ?? {};
    cur[j.mood] = (cur[j.mood] ?? 0) + 1;
    moods.set(monthKey(j.date), cur);
  }

  return {
    today: isoDate(now),
    horse: {
      ageYears: ctx.horse.birthYear ? now.getFullYear() - ctx.horse.birthYear : null,
      level: ctx.horse.level,
      discipline: ctx.horse.discipline,
      healthConditions: knownHealthConditions(ctx.horse.healthConditions),
      injuries: ctx.horse.injuries.map((i) => ({
        type: i.type,
        status: i.recoveryStatus,
        date: i.occurredAt ? isoDate(i.occurredAt) : null,
      })),
    },
    appointments: ctx.appointments
      .filter((a) => a.date >= from || (a.nextDueDate && a.nextDueDate >= now))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((a) => ({
        type: a.type,
        date: isoDate(a.date),
        endDate: a.endDate ? isoDate(a.endDate) : null,
        nextDue: a.nextDueDate ? isoDate(a.nextDueDate) : null,
        cost: a.cost ?? null,
        resultEntered: !!a.result?.trim(),
      })),
    expensesByMonth: [...expenses.values()].sort((a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category)),
    sessionsByMonth: [...sessions.values()].sort((a, b) => a.month.localeCompare(b.month)),
    upcomingSessions: ctx.sessions
      .filter((s) => dayDiff(now, s.date) >= 0 && dayDiff(now, s.date) <= 14 && !s.completed)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((s) => ({ date: isoDate(s.date), activity: s.activityType, durationMin: s.durationMinutes })),
    weights: [...ctx.weights]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6)
      .map((w) => ({ date: isoDate(w.date), kg: w.weightKg })),
    journalMoodsByMonth: [...moods.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, moods: m })),
  };
}

// --- Faits pour le résumé du mois --------------------------------------------

export type MonthFacts = {
  month: string;
  sessionsDone: number;
  sessionsPlannedNotDone: number;
  minutes: number;
  activities: Partial<Record<ActivityType, number>>;
  gpsKm: number;
  previousMonth: { sessionsDone: number; minutes: number };
  longestWeeklyStreak: number;
  competitions: { level: CompetitionLevel | null; resultEntered: boolean }[];
  healthEvents: AppointmentType[];
  moods: Partial<Record<Mood, number>>;
  expensesTotal: number;
  horse: { level: string; discipline: string; ageYears: number | null };
  rider: { goal: string | null };
};

/** Mois `month` (0-11) de `year`. */
export function buildMonthFacts(ctx: CoachContext, year: number, month: number): MonthFacts {
  const inMonth = (d: Date, y = year, m = month) => d.getFullYear() === y && d.getMonth() === m;
  const prevY = month === 0 ? year - 1 : year;
  const prevM = month === 0 ? 11 : month - 1;
  const done = ctx.sessions.filter((s) => s.completed && isWork(s) && inMonth(s.date));
  const prevDone = ctx.sessions.filter((s) => s.completed && isWork(s) && inMonth(s.date, prevY, prevM));
  const activities: Partial<Record<ActivityType, number>> = {};
  for (const s of done) activities[s.activityType] = (activities[s.activityType] ?? 0) + 1;
  const moods: Partial<Record<Mood, number>> = {};
  for (const j of ctx.journal.filter((j) => inMonth(j.date))) moods[j.mood] = (moods[j.mood] ?? 0) + 1;

  // Semaines (lundi → dimanche) du mois avec au moins une séance faite.
  const weeks = new Set(done.map((s) => isoDate(addDays(s.date, -((s.date.getDay() + 6) % 7)))));
  const sortedWeeks = [...weeks].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const w of sortedWeeks) {
    const d = new Date(`${w}T12:00:00`);
    run = prev && dayDiff(prev, d) === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return {
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    sessionsDone: done.length,
    sessionsPlannedNotDone: ctx.sessions.filter((s) => !s.completed && inMonth(s.date)).length,
    minutes: done.reduce((n, s) => n + (s.durationMinutes ?? 0), 0),
    activities,
    gpsKm: Math.round(done.reduce((n, s) => n + (s.ride?.gps ? s.ride.distanceMeters : 0), 0) / 100) / 10,
    previousMonth: { sessionsDone: prevDone.length, minutes: prevDone.reduce((n, s) => n + (s.durationMinutes ?? 0), 0) },
    longestWeeklyStreak: longest,
    competitions: ctx.appointments
      .filter((a) => a.type === "concours" && inMonth(a.date))
      .map((a) => ({ level: a.competitionLevel ?? null, resultEntered: !!a.result?.trim() })),
    healthEvents: ctx.appointments.filter((a) => a.type !== "concours" && inMonth(a.date)).map((a) => a.type),
    moods,
    expensesTotal: Math.round(ctx.expenses.filter((e) => inMonth(e.date)).reduce((n, e) => n + e.amount, 0)),
    horse: {
      level: ctx.horse.level,
      discipline: ctx.horse.discipline,
      ageYears: ctx.horse.birthYear ? year - ctx.horse.birthYear : null,
    },
    rider: { goal: ctx.rider.goal },
  };
}
