import { supabase } from "@/lib/supabase";
import { parseServerDate, parseServerDateOrNull } from "@/lib/serverDate";
import type { StableTask, TaskCompletion } from "@/tasks/tasksModel";
import { settleWrite } from "./shared";

/** Tâches d'écurie (cf. tasks/tasksModel.ts, rls.sql « taches »). Écriture
 * refusée par la base hors Écurie Pro : refus définitif dans la file. */

export async function pushTaskImpl(task: StableTask, stamp?: number): Promise<void> {
  const row = {
    id: task.id,
    horseId: task.horseId,
    title: task.title,
    assigneeUserId: task.assigneeUserId,
    assigneeName: task.assigneeName,
    weekdays: task.weekdays,
    dueDate: task.dueDate?.toISOString() ?? null,
    time: task.time,
    notes: task.notes,
    validFrom: task.validFrom.toISOString(),
    validUntil: task.validUntil?.toISOString() ?? null,
    updatedAt: task.updatedAt,
  };
  const { error } = await supabase.from("stable_tasks").upsert(row);
  await settleWrite("pushTask", "stable_tasks", task.id, error, row, stamp);
}

export async function deleteTaskRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("stable_tasks").delete().eq("id", id);
  await settleWrite("deleteTaskRemote", "stable_tasks", id, error, undefined, stamp);
}

export async function pushCompletionImpl(c: TaskCompletion, stamp?: number): Promise<void> {
  // Qui et quand : posés par la base.
  const row = { id: c.id, taskId: c.taskId, horseId: c.horseId, date: c.date.toISOString() };
  const { error } = await supabase.from("stable_task_completions").upsert(row, { ignoreDuplicates: true });
  await settleWrite("pushCompletion", "stable_task_completions", c.id, error, row, stamp);
}

export async function deleteCompletionRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("stable_task_completions").delete().eq("id", id);
  await settleWrite("deleteCompletionRemote", "stable_task_completions", id, error, undefined, stamp);
}

type TaskRow = {
  id: string;
  horseId: string;
  title: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  weekdays: number[] | null;
  dueDate: string | null;
  time: string | null;
  notes: string;
  validFrom: string;
  validUntil: string | null;
  updatedAt: string;
};

type CompletionRow = { id: string; taskId: string; horseId: string; date: string; doneByUserId: string | null; doneAt: string | null };

/** Tâches visibles (chevaux possédés et partagés) ; null si la lecture
 * échoue, table absente comprise (base pas encore migrée). */
export async function pullTasks(): Promise<StableTask[] | null> {
  const { data, error } = await supabase
    .from("stable_tasks")
    .select("id, horseId, title, assigneeUserId, assigneeName, weekdays, dueDate, time, notes, validFrom, validUntil, updatedAt");
  if (error || !data) return null;
  return (data as TaskRow[]).map((r) => ({
    id: r.id,
    horseId: r.horseId,
    title: r.title,
    assigneeUserId: r.assigneeUserId ?? null,
    assigneeName: r.assigneeName ?? null,
    weekdays: r.weekdays ?? [],
    dueDate: parseServerDateOrNull(r.dueDate),
    time: r.time ?? null,
    notes: r.notes ?? "",
    validFrom: parseServerDate(r.validFrom),
    validUntil: parseServerDateOrNull(r.validUntil),
    updatedAt: parseServerDate(r.updatedAt).toISOString(),
  }));
}

/** Coches des 60 derniers jours et à venir : assez pour la liste du jour et
 * la semaine, sans relire tout l'historique. */
export async function pullCompletions(): Promise<TaskCompletion[] | null> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("stable_task_completions")
    .select("id, taskId, horseId, date, doneByUserId, doneAt")
    .gte("date", since);
  if (error || !data) return null;
  return (data as CompletionRow[]).map((r) => ({
    id: r.id,
    taskId: r.taskId,
    horseId: r.horseId,
    date: parseServerDate(r.date),
    doneByUserId: r.doneByUserId ?? null,
    doneAt: parseServerDateOrNull(r.doneAt),
  }));
}
