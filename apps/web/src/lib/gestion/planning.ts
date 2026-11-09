/**
 * Espace gestionnaire (Écurie Pro) : planning de la semaine sur grand écran
 * et exports CSV. Logique pure, testée — les mêmes règles que l'app
 * (apps/mobile/src/planning/slots.ts, tasks/tasksModel.ts), recopiées ici
 * parce que le site n'importe rien de l'app. Les droits, eux, ne sont jamais
 * décidés ici : tout ce qui arrive du serveur est déjà filtré par les règles
 * RLS de la personne connectée (cf. packages/db/prisma/rls.sql).
 */

export type Horse = { id: string; name: string };
export type TeamMember = { userId: string; name: string };

export type Session = {
  id: string;
  horseId: string;
  activityType: string;
  date: Date;
  time: string;
  durationMinutes: number | null;
  completed: boolean;
  riderUserId: string | null;
  riderName: string | null;
  cancelledAt: Date | null;
};

export type Slot = {
  id: string;
  horseId: string;
  riderUserId: string | null;
  riderName: string | null;
  weekday: number;
  startTime: string | null;
  endTime: string | null;
  validFrom: Date;
  validUntil: Date | null;
};

export type Task = {
  id: string;
  horseId: string;
  title: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  weekdays: number[];
  dueDate: Date | null;
  time: string | null;
  validFrom: Date;
  validUntil: Date | null;
};

export type Completion = { id: string; taskId: string; date: Date; doneByUserId: string | null };

export type Fee = {
  id: string;
  horseId: string;
  payerUserId: string | null;
  payerName: string | null;
  month: string;
  amount: number;
  paidAt: Date | null;
};

/** Date du serveur : les colonnes `timestamp` n'ont pas de fuseau, ce sont des
 * instants UTC (l'app écrit toISOString) ; on les lit comme tels. */
export function parseServerDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value.trim()) ? value : `${value.trim().replace(" ", "T")}Z`);
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** 1 = lundi … 7 = dimanche. */
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;
export const weekStart = (d: Date) => addDays(startOfDay(d), -(isoWeekday(d) - 1));

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function occurrenceId(slotId: string, d: Date): string {
  return `${slotId}_${dayKey(d)}`;
}

export type WeekItem = {
  id: string;
  horseId: string;
  day: Date;
  time: string | null;
  riderUserId: string | null;
  riderName: string | null;
  done: boolean;
  fromSlot: boolean;
  activityType: string | null;
};

/** Séances de la semaine (hors annulées) et occurrences de créneaux pas
 * encore écrites, par jour puis par heure. */
export function buildWeek(sessions: Session[], slots: Slot[], start: Date): WeekItem[] {
  const first = startOfDay(start).getTime();
  const last = addDays(start, 6).getTime();
  const written = new Map(sessions.map((s) => [s.id, s]));
  const items: WeekItem[] = [];
  for (const s of sessions) {
    const day = startOfDay(s.date);
    if (s.cancelledAt || day.getTime() < first || day.getTime() > last) continue;
    items.push({
      id: s.id,
      horseId: s.horseId,
      day,
      time: s.time.trim() || null,
      riderUserId: s.riderUserId,
      riderName: s.riderName,
      done: s.completed,
      fromSlot: s.id.includes("_") && slots.some((sl) => s.id.startsWith(`${sl.id}_`)),
      activityType: s.activityType,
    });
  }
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    for (const slot of slots) {
      if (slot.weekday !== isoWeekday(day)) continue;
      if (day.getTime() < startOfDay(slot.validFrom).getTime()) continue;
      if (slot.validUntil && day.getTime() > startOfDay(slot.validUntil).getTime()) continue;
      if (written.has(occurrenceId(slot.id, day))) continue;
      items.push({ id: occurrenceId(slot.id, day), horseId: slot.horseId, day, time: slot.startTime, riderUserId: slot.riderUserId, riderName: slot.riderName, done: false, fromSlot: true, activityType: null });
    }
  }
  return items.sort((a, b) => a.day.getTime() - b.day.getTime() || (a.time ?? "99").localeCompare(b.time ?? "99"));
}

export function riderLabel(item: { riderUserId: string | null; riderName: string | null }, team: TeamMember[]): string | null {
  if (item.riderUserId) return team.find((m) => m.userId === item.riderUserId)?.name ?? null;
  return item.riderName?.trim() || null;
}

export function taskRunsOn(task: Task, d: Date): boolean {
  const day = startOfDay(d).getTime();
  if (day < startOfDay(task.validFrom).getTime()) return false;
  if (task.validUntil && day > startOfDay(task.validUntil).getTime()) return false;
  if (task.weekdays.length === 0) return !!task.dueDate && startOfDay(task.dueDate).getTime() === day;
  return task.weekdays.includes(isoWeekday(d));
}

export type TaskRow = { task: Task; day: Date; completion: Completion | null };

export function weekTasks(tasks: Task[], completions: Completion[], start: Date): TaskRow[] {
  const byId = new Map(completions.map((c) => [c.id, c]));
  const rows: TaskRow[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    for (const task of tasks) {
      if (taskRunsOn(task, day)) rows.push({ task, day, completion: byId.get(`${task.id}_${dayKey(day)}`) ?? null });
    }
  }
  return rows.sort((a, b) => a.day.getTime() - b.day.getTime() || (a.task.time ?? "99").localeCompare(b.task.time ?? "99"));
}

/** Cellule de tableur : une valeur saisie par un autre (prénom, titre) qui
 * commence par = + - @ serait lue comme une formule à l'ouverture dans Excel
 * (injection CSV) : neutralisée par une apostrophe. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV pour Excel en français : séparateur « ; », fins de ligne CRLF, BOM
 * UTF-8 pour les accents. */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

const fr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const weekday = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long" });

export function planningCsv(items: WeekItem[], horses: Horse[], teams: Record<string, TeamMember[]>): string {
  const name = (id: string) => horses.find((h) => h.id === id)?.name ?? "";
  return toCsv(
    ["Date", "Jour", "Heure", "Cheval", "Cavalier", "Fait", "Créneau régulier"],
    items.map((i) => [fr(i.day), weekday(i.day), i.time, name(i.horseId), riderLabel(i, teams[i.horseId] ?? []), i.done ? "oui" : "non", i.fromSlot ? "oui" : "non"])
  );
}

export function tasksCsv(rows: TaskRow[], horses: Horse[], teams: Record<string, TeamMember[]>): string {
  const name = (id: string) => horses.find((h) => h.id === id)?.name ?? "";
  const who = (userId: string | null, free: string | null, horseId: string) =>
    userId ? (teams[horseId] ?? []).find((m) => m.userId === userId)?.name ?? "" : (free?.trim() ?? "");
  return toCsv(
    ["Date", "Heure", "Cheval", "Tâche", "Confiée à", "Fait", "Fait par"],
    rows.map((r) => [
      fr(r.day),
      r.task.time,
      name(r.task.horseId),
      r.task.title,
      who(r.task.assigneeUserId, r.task.assigneeName, r.task.horseId),
      r.completion ? "oui" : "non",
      r.completion ? who(r.completion.doneByUserId, null, r.task.horseId) : "",
    ])
  );
}

export function feesCsv(fees: Fee[], horses: Horse[], teams: Record<string, TeamMember[]>): string {
  const name = (id: string) => horses.find((h) => h.id === id)?.name ?? "";
  return toCsv(
    ["Mois", "Cheval", "Payeur", "Montant (€)", "Reçu le"],
    [...fees]
      .sort((a, b) => a.month.localeCompare(b.month) || name(a.horseId).localeCompare(name(b.horseId)))
      .map((f) => [f.month, name(f.horseId), riderLabel({ riderUserId: f.payerUserId, riderName: f.payerName }, teams[f.horseId] ?? []), f.amount.toFixed(2).replace(".", ","), f.paidAt ? fr(f.paidAt) : ""])
  );
}
