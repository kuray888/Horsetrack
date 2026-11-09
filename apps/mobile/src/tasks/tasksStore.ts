import { useSyncExternalStore } from "react";
import { readJsonChecked, removeJson, writeJson } from "@/lib/localStore";
import { pendingIdsFor } from "@/lib/syncQueue";
import { deleteCompletionRemote, deleteTaskRemote, pullCompletions, pullTasks, pushCompletion, pushTask } from "@/lib/cloudSync";
import { mergeByUpdatedAt } from "@/extras/model";
import { completionId, keepLocalCompletion, type StableTask, type TaskCompletion } from "@/tasks/tasksModel";

/**
 * Tâches d'écurie : sur le téléphone d'abord, envoyées au serveur à chaque
 * modification (reprise par la file de synchro), relues avec le reste (cf.
 * lib/cloudRefresh.tsx). Même construction que planning/slotsStore.ts.
 */

const KEY = "stable_tasks_v1";
type StoredTask = Omit<StableTask, "dueDate" | "validFrom" | "validUntil"> & { dueDate: string | null; validFrom: string; validUntil: string | null };
type StoredCompletion = Omit<TaskCompletion, "date" | "doneAt"> & { date: string; doneAt: string | null };
type State = { tasks: StableTask[]; completions: TaskCompletion[] };

let state: State = { tasks: [], completions: [] };
let loaded = false;
let loadFailed = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function persist() {
  if (!loaded || loadFailed) return;
  void writeJson(KEY, {
    tasks: state.tasks.map((t): StoredTask => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null, validFrom: t.validFrom.toISOString(), validUntil: t.validUntil?.toISOString() ?? null })),
    completions: state.completions.map((c): StoredCompletion => ({ ...c, date: c.date.toISOString(), doneAt: c.doneAt?.toISOString() ?? null })),
  });
}

function setState(next: State) {
  state = next;
  persist();
  emit();
}

export function loadTasks(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const { ok, value } = await readJsonChecked<{ tasks: StoredTask[]; completions: StoredCompletion[] } | null>(KEY, null);
    if (!ok) loadFailed = true;
    if (value) {
      state = {
        tasks: (value.tasks ?? []).map((t) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null, validFrom: new Date(t.validFrom), validUntil: t.validUntil ? new Date(t.validUntil) : null })),
        completions: (value.completions ?? []).map((c) => ({ ...c, date: new Date(c.date), doneAt: c.doneAt ? new Date(c.doneAt) : null })),
      };
    }
    loaded = true;
    emit();
  })();
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadTasks();
  return () => listeners.delete(listener);
}

const getState = () => state;

export function useTasks(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

function generateId(): string {
  return `tk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function saveTask(input: Omit<StableTask, "id" | "updatedAt"> & { id?: string }): StableTask {
  const task: StableTask = { ...input, id: input.id ?? generateId(), updatedAt: new Date().toISOString() };
  const exists = state.tasks.some((t) => t.id === task.id);
  setState({ ...state, tasks: exists ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task] });
  pushTask(task).catch(() => {});
  return task;
}

export function deleteTask(id: string): void {
  setState({ tasks: state.tasks.filter((t) => t.id !== id), completions: state.completions.filter((c) => c.taskId !== id) });
  deleteTaskRemote(id).catch(() => {});
}

/** Coche, ou décoche, une tâche pour un jour. Qui et quand : posés par la base ;
 * en local, `me` en attendant la relecture. */
export function setTaskDone(task: StableTask, date: Date, done: boolean, me: string | null): void {
  const id = completionId(task.id, date);
  if (done) {
    if (state.completions.some((c) => c.id === id)) return;
    const c: TaskCompletion = { id, taskId: task.id, horseId: task.horseId, date: new Date(date.getFullYear(), date.getMonth(), date.getDate()), doneByUserId: me, doneAt: new Date() };
    setState({ ...state, completions: [...state.completions, c] });
    pushCompletion(c).catch(() => {});
  } else {
    setState({ ...state, completions: state.completions.filter((c) => c.id !== id) });
    deleteCompletionRemote(id).catch(() => {});
  }
}

export async function refreshTasks(pullStartedAt: number): Promise<void> {
  await loadTasks();
  if (loadFailed) return;
  const [tasks, completions] = await Promise.all([pullTasks().catch(() => null), pullCompletions().catch(() => null)]);
  let next = state;
  if (tasks) next = { ...next, tasks: mergeByUpdatedAt(state.tasks, tasks, (t) => t.id, pendingIdsFor("stable_tasks"), pullStartedAt) };
  if (completions) {
    // Les coches sont lues sur 60 jours : les plus anciennes restent en local.
    const pending = pendingIdsFor("stable_task_completions");
    const remote = new Map(completions.map((c) => [c.id, c]));
    const keptLocal = state.completions.filter((c) => pending.has(c.id) || (!remote.has(c.id) && keepLocalCompletion(c, pullStartedAt, false)));
    next = { ...next, completions: [...completions.filter((c) => !pending.has(c.id)), ...keptLocal] };
  }
  if (next !== state) setState(next);
}

/** Déconnexion, suppression du compte, changement de compte. */
export async function clearTasks(): Promise<void> {
  state = { tasks: [], completions: [] };
  await removeJson(KEY);
  emit();
}
