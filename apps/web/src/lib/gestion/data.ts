import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, occurrenceId, parseServerDate, type Completion, type Fee, type Horse, type Session, type Slot, type Task, type TeamMember } from "@/lib/gestion/planning";

/** Lectures de l'espace gestionnaire : tout passe par les règles RLS de la
 * personne connectée. Une erreur est levée telle quelle, l'écran la dit. */

const fail = (what: string, error: { message?: string } | null): never => {
  throw new Error(`${what} : ${error?.message ?? "échec"}`);
};

const date = (v: string | null) => (v ? parseServerDate(v) : null);

/** Chevaux dont le propriétaire est en Écurie Pro (cf. rls.sql
 * horse_owner_is_pro) : l'espace n'existe que pour eux. */
export async function loadProHorses(client: SupabaseClient): Promise<Horse[]> {
  const { data, error } = await client.from("horses").select("id, name").order("name");
  if (error || !data) return fail("Chevaux", error);
  const flags = await Promise.all(
    (data as Horse[]).map(async (h) => {
      const res = await client.rpc("horse_owner_is_pro", { _horse_id: h.id });
      return res.error ? false : res.data === true;
    })
  );
  return (data as Horse[]).filter((_, i) => flags[i]);
}

export async function loadTeams(client: SupabaseClient, horseIds: string[]): Promise<Record<string, TeamMember[]>> {
  const entries = await Promise.all(
    horseIds.map(async (id) => {
      const { data } = await client.rpc("horse_team", { _horse_id: id });
      const team = ((data ?? []) as { userId: string; name: string }[]).map((m) => ({ userId: m.userId, name: m.name }));
      return [id, team] as const;
    })
  );
  return Object.fromEntries(entries);
}

export type WeekData = { sessions: Session[]; slots: Slot[]; tasks: Task[]; completions: Completion[]; fees: Fee[] };

export async function loadWeek(client: SupabaseClient, horseIds: string[], start: Date): Promise<WeekData> {
  // Les dates sont des minuits locaux de l'appareil qui les a écrites : une
  // marge d'un jour de chaque côté, le tri exact se fait après lecture.
  const from = addDays(start, -1).toISOString();
  const to = addDays(start, 8).toISOString();
  const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const last = addDays(start, 6);
  const endMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  const [sessions, slots, tasks, completions, fees] = await Promise.all([
    client
      .from("training_sessions")
      .select("id, horseId, activityType, date, time, durationMinutes, completed, riderUserId, riderName, cancelledAt")
      .in("horseId", horseIds)
      .gte("date", from)
      .lte("date", to),
    client.from("ride_slots").select("id, horseId, riderUserId, riderName, weekday, startTime, endTime, validFrom, validUntil").in("horseId", horseIds),
    client.from("stable_tasks").select("id, horseId, title, assigneeUserId, assigneeName, weekdays, dueDate, time, validFrom, validUntil").in("horseId", horseIds),
    client.from("stable_task_completions").select("id, taskId, date, doneByUserId").in("horseId", horseIds).gte("date", from).lte("date", to),
    // Participation aux frais : la base ne renvoie que ce que la personne a le droit de voir.
    client.from("participation_fees").select("id, horseId, payerUserId, payerName, month, amount, paidAt").in("horseId", horseIds).in("month", [...new Set([month, endMonth])]),
  ]);
  if (sessions.error) fail("Séances", sessions.error);
  if (slots.error) fail("Créneaux", slots.error);
  // Une occurrence de créneau déjà écrite mais déplacée hors de la semaine
  // reste « écrite » (comme dans l'app) : on relit ces séances par identifiant.
  const weekIds: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const isoDay = ((day.getDay() + 6) % 7) + 1;
    for (const slot of slots.data ?? []) if (slot.weekday === isoDay) weekIds.push(occurrenceId(slot.id, day));
  }
  const known = new Set((sessions.data ?? []).map((r) => r.id));
  const missing = weekIds.filter((id) => !known.has(id));
  if (missing.length > 0) {
    const moved = await client
      .from("training_sessions")
      .select("id, horseId, activityType, date, time, durationMinutes, completed, riderUserId, riderName, cancelledAt")
      .in("id", missing);
    if (moved.error) fail("Séances", moved.error);
    sessions.data = [...(sessions.data ?? []), ...(moved.data ?? [])];
  }
  if (tasks.error) fail("Tâches", tasks.error);
  if (completions.error) fail("Coches", completions.error);
  // Frais : table absente tant que la migration n'est pas passée, ce n'est pas bloquant.
  return {
    sessions: (sessions.data ?? []).map((r) => ({
      id: r.id,
      horseId: r.horseId,
      activityType: r.activityType,
      date: parseServerDate(r.date),
      time: r.time ?? "",
      durationMinutes: r.durationMinutes ?? null,
      completed: !!r.completed,
      riderUserId: r.riderUserId ?? null,
      riderName: r.riderName ?? null,
      cancelledAt: date(r.cancelledAt),
    })),
    slots: (slots.data ?? []).map((r) => ({
      id: r.id,
      horseId: r.horseId,
      riderUserId: r.riderUserId ?? null,
      riderName: r.riderName ?? null,
      weekday: r.weekday,
      startTime: r.startTime ?? null,
      endTime: r.endTime ?? null,
      validFrom: parseServerDate(r.validFrom),
      validUntil: date(r.validUntil),
    })),
    tasks: (tasks.data ?? []).map((r) => ({
      id: r.id,
      horseId: r.horseId,
      title: r.title,
      assigneeUserId: r.assigneeUserId ?? null,
      assigneeName: r.assigneeName ?? null,
      weekdays: r.weekdays ?? [],
      dueDate: date(r.dueDate),
      time: r.time ?? null,
      validFrom: parseServerDate(r.validFrom),
      validUntil: date(r.validUntil),
    })),
    completions: (completions.data ?? []).map((r) => ({ id: r.id, taskId: r.taskId, date: parseServerDate(r.date), doneByUserId: r.doneByUserId ?? null })),
    fees: (fees.data ?? []).map((r) => ({
      id: r.id,
      horseId: r.horseId,
      payerUserId: r.payerUserId ?? null,
      payerName: r.payerName ?? null,
      month: r.month,
      amount: Number(r.amount),
      paidAt: date(r.paidAt),
    })),
  };
}
