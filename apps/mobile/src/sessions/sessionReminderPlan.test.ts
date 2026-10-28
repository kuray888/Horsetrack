import { describe, it, expect } from "vitest";
import {
  diffSessionReminders,
  parseSessionTime,
  planSessionReminders,
  postponedDate,
  sessionReminderTrigger,
  SESSION_REMINDER_MAX,
  type SessionLike,
} from "./sessionReminderPlan";

const now = new Date(2026, 9, 27, 10, 0); // mardi 27 oct. 10h
const session = (id: string, date: Date, time = "18h00", completed = false): SessionLike => ({
  id,
  horseId: "h1",
  date,
  time,
  completed,
  durationMinutes: 45,
  customActivityLabel: null,
});
const label = () => "Saut";
const horseName = () => "Floy";

describe("parseSessionTime", () => {
  it("lit les heures saisies dans l'app", () => {
    expect(parseSessionTime("18h00")).toEqual({ hour: 18, minute: 0 });
    expect(parseSessionTime("9h")).toEqual({ hour: 9, minute: 0 });
    expect(parseSessionTime(" 14 h 30 ")).toEqual({ hour: 14, minute: 30 });
  });
  it("renvoie null sans heure lisible", () => {
    expect(parseSessionTime("")).toBeNull();
    expect(parseSessionTime("Heure libre")).toBeNull();
    expect(parseSessionTime("25h00")).toBeNull();
  });
});

describe("sessionReminderTrigger", () => {
  it("prévient une heure avant, ou à 9h sans heure", () => {
    const t = sessionReminderTrigger({ date: new Date(2026, 9, 28), time: "18h00" }, now)!;
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([28, 17, 0]);
    const free = sessionReminderTrigger({ date: new Date(2026, 9, 28), time: "" }, now)!;
    expect([free.getDate(), free.getHours()]).toEqual([28, 9]);
  });
  it("ne programme rien dans le passé", () => {
    expect(sessionReminderTrigger({ date: new Date(2026, 9, 27), time: "10h30" }, now)).toBeNull();
    expect(sessionReminderTrigger({ date: new Date(2026, 9, 27), time: "" }, now)).toBeNull();
  });
});

describe("planSessionReminders", () => {
  it("garde les séances à faire des 7 prochains jours, les plus proches d'abord", () => {
    const sessions = [
      session("later", new Date(2026, 9, 30)),
      session("soon", new Date(2026, 9, 28)),
      session("done", new Date(2026, 9, 28), "18h00", true),
      session("far", new Date(2026, 10, 10)),
      session("past", new Date(2026, 9, 26)),
    ];
    const planned = planSessionReminders(sessions, label, horseName, now);
    expect(planned.map((p) => p.sessionId)).toEqual(["soon", "later"]);
    expect(planned[0].title).toBe("Saut avec Floy");
    expect(planned[0].body).toBe("Séance prévue à 18h00 · 45 min.");
  });
  it("plafonne le nombre de rappels", () => {
    const sessions = Array.from({ length: 20 }, (_, i) => session(`s${i}`, new Date(2026, 9, 28), `${8 + (i % 12)}h00`));
    expect(planSessionReminders(sessions, label, horseName, now)).toHaveLength(SESSION_REMINDER_MAX);
  });
});

describe("diffSessionReminders", () => {
  it("garde ce qui n'a pas changé, remplace le reste, annule l'obsolète", () => {
    const desired = planSessionReminders(
      [session("a", new Date(2026, 9, 28)), session("b", new Date(2026, 9, 29))],
      label,
      horseName,
      now
    );
    const stored = {
      a: { notificationId: "n-a", key: desired[0].key },
      b: { notificationId: "n-b", key: "ancienne heure" },
      gone: { notificationId: "n-gone", key: "x" },
    };
    const { toCancel, toSchedule, kept } = diffSessionReminders(stored, desired);
    expect(toCancel.sort()).toEqual(["n-b", "n-gone"]);
    expect(toSchedule.map((r) => r.sessionId)).toEqual(["b"]);
    expect(Object.keys(kept)).toEqual(["a"]);
  });
});

describe("postponedDate", () => {
  it("reporte au lendemain du jour où l'on reporte", () => {
    const d = postponedDate(new Date(2026, 9, 31, 22));
    expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([10, 1, 0]);
  });
});
