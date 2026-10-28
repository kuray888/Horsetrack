import { describe, expect, it } from "vitest";
import { toCalendarEvent, type CalendarSource } from "@/agenda/calendarEvent";

const base: CalendarSource = {
  title: "Maréchal",
  typeLabel: "Maréchal-ferrant",
  horseName: "Éclair",
  date: new Date(2026, 10, 3),
  endDate: null,
  time: "14:30",
  location: " Écurie du Val ",
  notes: "",
  professional: null,
  dossard: null,
};

describe("toCalendarEvent", () => {
  it("un rendez-vous avec heure dure 1 h, au nom du cheval", () => {
    const e = toCalendarEvent(base, "ios");
    expect(e.allDay).toBe(false);
    expect(e.startDate).toEqual(new Date(2026, 10, 3, 14, 30));
    expect(e.endDate).toEqual(new Date(2026, 10, 3, 15, 30));
    expect(e.title).toBe("Maréchal · Éclair");
    expect(e.location).toBe("Écurie du Val");
  });

  it("accepte l'heure écrite « 9h05 »", () => {
    expect(toCalendarEvent({ ...base, time: "9h05" }, "ios").startDate).toEqual(new Date(2026, 10, 3, 9, 5));
  });

  it("sans heure : journée entière, fin selon la plateforme", () => {
    const ios = toCalendarEvent({ ...base, time: "" }, "ios");
    expect(ios.allDay).toBe(true);
    expect(ios.startDate).toEqual(new Date(2026, 10, 3));
    expect(ios.endDate).toEqual(new Date(2026, 10, 3, 23, 59));
    const android = toCalendarEvent({ ...base, time: "" }, "android");
    expect(android.endDate).toEqual(new Date(2026, 10, 4));
  });

  it("une heure illisible donne une journée entière plutôt qu'une date fausse", () => {
    expect(toCalendarEvent({ ...base, time: "matin" }, "ios").allDay).toBe(true);
    expect(toCalendarEvent({ ...base, time: "25:00" }, "ios").allDay).toBe(true);
  });

  it("un concours sur plusieurs jours couvre tous les jours, même avec une heure", () => {
    const e = toCalendarEvent(
      { ...base, title: "CSI Lamotte", typeLabel: "Concours", endDate: new Date(2026, 10, 6), dossard: "112" },
      "ios"
    );
    expect(e.allDay).toBe(true);
    expect(e.startDate).toEqual(new Date(2026, 10, 3));
    expect(e.endDate).toEqual(new Date(2026, 10, 6, 23, 59));
    expect(e.notes).toContain("Dossard : 112");
  });

  it("une fin le même jour ne change rien", () => {
    expect(toCalendarEvent({ ...base, endDate: new Date(2026, 10, 3, 18) }, "ios").allDay).toBe(false);
  });

  it("les notes rappellent le type, le professionnel et l'origine", () => {
    const e = toCalendarEvent({ ...base, horseName: null, professional: "Dr Martin", notes: " Vaccin grippe " }, "ios");
    expect(e.title).toBe("Maréchal");
    expect(e.notes).toBe("Maréchal-ferrant\nAvec : Dr Martin\nVaccin grippe\nAjouté depuis Horsetrack");
  });
});
