import { describe, expect, it } from "vitest";
import type { Appointment, Expense } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";
import { buildStableOverview, overdueCare, weekBounds } from "./stableOverview";

const d = (iso: string) => new Date(`${iso}T12:00:00`);
const appt = (p: Partial<Appointment>) => ({ id: Math.random().toString(), horseId: "a", type: "vaccin", date: d("2026-01-01"), nextDueDate: null, ...p }) as Appointment;
const session = (p: Partial<TrainingSession>) => ({ id: Math.random().toString(), horseId: "a", date: d("2026-11-09"), completed: false, ...p }) as TrainingSession;
const expense = (p: Partial<Expense>) => ({ id: Math.random().toString(), horseId: "a", amount: 0, date: d("2026-11-02"), ...p }) as Expense;
const today = d("2026-11-11"); // mercredi

describe("overdueCare", () => {
  it("échéance passée, soin jamais refait : en retard", () => {
    const late = appt({ date: d("2025-11-01"), nextDueDate: d("2026-11-01") });
    expect(overdueCare([late], "a", today)).toEqual([late]);
  });

  it("soin refait depuis : plus en retard", () => {
    const old = appt({ date: d("2025-11-01"), nextDueDate: d("2026-11-01") });
    const redone = appt({ date: d("2026-11-05"), nextDueDate: d("2027-11-05") });
    expect(overdueCare([old, redone], "a", today)).toEqual([]);
  });

  it("ignore les autres chevaux et les échéances à venir", () => {
    expect(overdueCare([appt({ horseId: "b", nextDueDate: d("2026-01-01") }), appt({ nextDueDate: d("2026-12-01") })], "a", today)).toEqual([]);
  });
});

describe("weekBounds", () => {
  it("du lundi au lundi suivant", () => {
    const { start, end } = weekBounds(today);
    expect([start.getDate(), start.getDay(), end.getDate()]).toEqual([9, 1, 16]);
  });
});

describe("buildStableOverview", () => {
  it("résume chaque cheval et met en tête ceux qui ont du retard", () => {
    const rows = buildStableOverview({
      horses: [
        { id: "a", name: "Tornade", photoUrl: null },
        { id: "b", name: "Éclair", photoUrl: null },
      ],
      appointments: [appt({ horseId: "b", type: "marechal", date: d("2026-09-01"), nextDueDate: d("2026-10-20") })],
      sessions: [session({ completed: true }), session({}), session({ date: d("2026-11-01") })],
      expenses: [expense({ amount: 450 }), expense({ amount: 90 }), expense({ amount: 30, date: d("2026-10-30") })],
      today,
    });
    expect(rows.map((r) => r.name)).toEqual(["Éclair", "Tornade"]);
    const tornade = rows[1];
    expect([tornade.weekDone, tornade.weekTotal, tornade.monthExpenses]).toEqual([1, 2, 540]);
    expect(rows[0].overdue).toHaveLength(1);
  });
});
