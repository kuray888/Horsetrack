/**
 * Tâches d'écurie (Écurie Pro v2) : sortie au pré, repas, couverture, soin
 * saisi par l'utilisateur. Ponctuelles ou récurrentes, confiées à quelqu'un,
 * cochées avec qui et quand. L'app ne propose jamais de posologie : le texte
 * est celui de l'utilisateur. Logique pure, testée.
 */

export type StableTask = {
  id: string;
  horseId: string;
  title: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  /** Jours ISO (1 = lundi … 7 = dimanche) ; vide = ponctuelle. */
  weekdays: number[];
  /** Jour d'une tâche ponctuelle. */
  dueDate: Date | null;
  /** "HH:MM", null = dans la journée. */
  time: string | null;
  notes: string;
  validFrom: Date;
  validUntil: Date | null;
  updatedAt: string;
};

export type TaskCompletion = {
  /** "<tâche>_<AAAA-MM-JJ>" */
  id: string;
  taskId: string;
  horseId: string;
  date: Date;
  doneByUserId: string | null;
  doneAt: Date | null;
};

export type TaskOccurrence = { task: StableTask; date: Date; completion: TaskCompletion | null };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function completionId(taskId: string, date: Date): string {
  return `${taskId}_${dayKey(date)}`;
}

/** La tâche a-t-elle lieu ce jour-là ? */
export function taskRunsOn(task: StableTask, date: Date): boolean {
  const day = startOfDay(date).getTime();
  if (day < startOfDay(task.validFrom).getTime()) return false;
  if (task.validUntil && day > startOfDay(task.validUntil).getTime()) return false;
  if (task.weekdays.length === 0) return !!task.dueDate && startOfDay(task.dueDate).getTime() === day;
  return task.weekdays.includes(isoWeekday(date));
}

/** Tâches d'un jour, à faire d'abord, par heure ; une tâche ponctuelle déjà
 * faite reste visible ce jour-là. */
export function tasksForDay(tasks: StableTask[], completions: TaskCompletion[], day: Date): TaskOccurrence[] {
  const byId = new Map(completions.map((c) => [c.id, c]));
  return tasks
    .filter((t) => taskRunsOn(t, day))
    .map((task) => ({ task, date: startOfDay(day), completion: byId.get(completionId(task.id, day)) ?? null }))
    .sort(
      (a, b) =>
        Number(!!a.completion) - Number(!!b.completion) ||
        (a.task.time ?? "99").localeCompare(b.task.time ?? "99") ||
        a.task.title.localeCompare(b.task.title)
    );
}

/** « Ma liste du jour » : ce qui m'est confié. */
export function myTasks(occurrences: TaskOccurrence[], me: string | null): TaskOccurrence[] {
  return occurrences.filter((o) => !!me && o.task.assigneeUserId === me);
}

export type DaySummary = { total: number; done: number; late: number };

/** Avancement d'un jour ; « en retard » : heure passée, pas encore faite
 * (seulement pour aujourd'hui). */
export function summarizeDay(occurrences: TaskOccurrence[], now: Date): DaySummary {
  const isToday = occurrences.length > 0 && dayKey(occurrences[0].date) === dayKey(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const late = occurrences.filter((o) => {
    const m = o.task.time ? /^(\d{1,2}):(\d{2})$/.exec(o.task.time) : null;
    return isToday && !o.completion && !!m && Number(m[1]) * 60 + Number(m[2]) < minutes;
  }).length;
  return { total: occurrences.length, done: occurrences.filter((o) => o.completion).length, late };
}

/** Qui peut cocher : la personne chargée de la tâche, ou qui gère les tâches
 * du cheval (miroir de rls.sql can_complete_task). */
export function canTick(task: StableTask, me: string | null, canManage: boolean): boolean {
  return canManage || (!!me && task.assigneeUserId === me);
}

/** Les coches sont lues sur 60 jours (lib/sync/tasks.ts pullCompletions). */
export const COMPLETIONS_WINDOW_MS = 60 * 86_400_000;

/** Après une lecture serveur : garder une coche locale que le serveur ne
 * renvoie pas ? Oui si elle est en attente d'envoi, plus récente que la
 * lecture (écriture en route) ou hors de la fenêtre lue ; sinon elle a été
 * supprimée ailleurs. */
export function keepLocalCompletion(c: TaskCompletion, pullStartedAt: number, pending: boolean): boolean {
  if (pending) return true;
  if (c.date.getTime() < pullStartedAt - COMPLETIONS_WINDOW_MS) return true;
  return !!c.doneAt && c.doneAt.getTime() >= pullStartedAt;
}

const WEEKDAY_LABELS = ["", "lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

/** « tous les jours », « lun, mer, ven » ; null pour une tâche ponctuelle. */
export function recurrenceLabel(weekdays: number[], everyDay: string): string | null {
  if (weekdays.length === 0) return null;
  const days = [...new Set(weekdays)].sort();
  return days.length === 7 ? everyDay : days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
