import type { ActivityType } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";

/**
 * Créneaux récurrents (Écurie Pro v2) : « Léa monte Tornade le mardi et le
 * jeudi, 18 h – 19 h 30 ». Ils ne créent pas de séances à l'avance : les
 * occurrences sont calculées ici, et une séance n'est écrite que quand
 * quelqu'un agit dessus, avec l'identifiant `<créneau>_<AAAA-MM-JJ>` —
 * deux appareils hors ligne écrivent la même ligne (cf. rls.sql
 * « creneaux »). Logique pure.
 */

export type SlotKind = "DP" | "LESSON" | "WORK";

export type RideSlot = {
  id: string;
  horseId: string;
  riderUserId: string | null;
  riderName: string | null;
  /** 1 = lundi … 7 = dimanche. */
  weekday: number;
  /** "HH:MM", null = horaire libre. */
  startTime: string | null;
  endTime: string | null;
  validFrom: Date;
  validUntil: Date | null;
  kind: SlotKind;
  activityType: ActivityType | null;
  notes: string;
  updatedAt: string;
};

export type SlotOccurrence = {
  /** Identifiant de la séance correspondante, écrite ou non. */
  id: string;
  slot: RideSlot;
  date: Date;
  /** La séance déjà écrite pour cette occurrence (faite, modifiée…). */
  session: TrainingSession | null;
};

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date locale. */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function occurrenceId(slotId: string, date: Date): string {
  return `${slotId}_${dayKey(date)}`;
}

/** Le créneau a-t-il lieu ce jour-là ? */
export function slotRunsOn(slot: RideSlot, date: Date): boolean {
  const day = startOfDay(date).getTime();
  if (isoWeekday(date) !== slot.weekday) return false;
  if (day < startOfDay(slot.validFrom).getTime()) return false;
  if (slot.validUntil && day > startOfDay(slot.validUntil).getTime()) return false;
  return true;
}

/**
 * Occurrences des créneaux entre `from` et `to` (inclus, jours locaux), avec
 * leur séance si elle existe déjà. Une occurrence annulée disparaît ; une
 * séance déplacée à une autre date (modifiée) reste attachée à son créneau
 * mais s'affiche à sa nouvelle date via la liste des séances, pas ici.
 */
export function slotOccurrences(slots: RideSlot[], sessions: TrainingSession[], from: Date, to: Date): SlotOccurrence[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const out: SlotOccurrence[] = [];
  const end = startOfDay(to).getTime();
  for (let d = startOfDay(from); d.getTime() <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    for (const slot of slots) {
      if (!slotRunsOn(slot, d)) continue;
      const id = occurrenceId(slot.id, d);
      const session = byId.get(id) ?? null;
      if (session?.cancelledAt) continue;
      if (session && dayKey(session.date) !== dayKey(d)) continue;
      out.push({ id, slot, date: new Date(d), session });
    }
  }
  return out.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.slot.startTime ?? "99").localeCompare(b.slot.startTime ?? "99")
  );
}

/** Durée en minutes entre deux heures "HH:MM" (null si l'une manque ou si
 * la fin précède le début). */
export function slotDuration(startTime: string | null, endTime: string | null): number | null {
  const parse = (v: string | null) => {
    const m = v ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null;
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = parse(startTime);
  const b = parse(endTime);
  return a !== null && b !== null && b > a ? b - a : null;
}

/** La séance à écrire quand on agit sur une occurrence pas encore écrite. */
export function sessionForOccurrence(occurrence: SlotOccurrence): TrainingSession {
  const { slot, date } = occurrence;
  return {
    id: occurrence.id,
    horseId: slot.horseId,
    activityType: slot.activityType ?? (slot.kind === "LESSON" ? "dressage" : "balade"),
    customActivityLabel: null,
    date: startOfDay(date),
    time: slot.startTime ?? "",
    durationMinutes: slotDuration(slot.startTime, slot.endTime),
    intensity: null,
    notes: slot.notes,
    completed: false,
    riderUserId: slot.riderUserId,
    riderName: slot.riderName,
    slotId: slot.id,
    cancelledAt: null,
  };
}

/** Créneaux de la semaine-type d'un cheval, du lundi au dimanche, puis par
 * heure ; seulement ceux encore valides à `today`. */
export function activeSlots(slots: RideSlot[], today: Date): RideSlot[] {
  const day = startOfDay(today).getTime();
  return slots
    .filter((s) => !s.validUntil || startOfDay(s.validUntil).getTime() >= day)
    .sort((a, b) => a.weekday - b.weekday || (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
}
