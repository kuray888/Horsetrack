import { describe, expect, it } from "vitest";
import { buildWidgetData } from "@/lib/widgetData";

const today = new Date(2026, 9, 27, 15, 42);

describe("buildWidgetData", () => {
  it("transmet des dates en AAAA-MM-JJ, pas des libellés qui vieilliraient", () => {
    const data = buildWidgetData({
      today,
      horseName: " Éclair ",
      todaySession: { title: "Dressage", durationMinutes: 45, time: "18:00", completed: false },
      weeklyDone: 2,
      weeklyTotal: 4,
      nextEvent: { title: "Maréchal", date: new Date(2026, 9, 29), time: "" },
      alertsCount: 1,
    });
    expect(data).toEqual({
      day: "2026-10-27",
      horseName: "Éclair",
      todaySessionTitle: "Dressage",
      todaySessionDurationMin: 45,
      todaySessionTime: "18:00",
      todaySessionDone: false,
      weeklyDone: 2,
      weeklyTotal: 4,
      nextEventTitle: "Maréchal",
      nextEventDay: "2026-10-29",
      nextEventTime: null,
      alertsCount: 1,
    });
  });

  it("sans cheval ni séance : nom par défaut et champs vides", () => {
    const data = buildWidgetData({
      today,
      horseName: null,
      todaySession: null,
      weeklyDone: 0,
      weeklyTotal: 0,
      nextEvent: null,
      alertsCount: 0,
    });
    expect(data.horseName).toBe("Mon cheval");
    expect(data.todaySessionTitle).toBeNull();
    expect(data.todaySessionDone).toBe(false);
    expect(data.nextEventDay).toBeNull();
  });
});
