import { describe, expect, it } from "vitest";
import { buildWeek, csvCell, feesCsv, parseServerDate, planningCsv, riderLabel, toCsv, weekStart, weekTasks, type Session, type Slot, type Task } from "./planning";

const MON = new Date(2026, 10, 9);
const team = { h1: [{ userId: "u-dp", name: "Léa" }] };
const horses = [{ id: "h1", name: "Tornade" }];

const session = (over: Partial<Session> = {}): Session => ({
  id: "s1", horseId: "h1", activityType: "DRESSAGE", date: new Date(2026, 10, 9), time: "", durationMinutes: 45, completed: false,
  riderUserId: null, riderName: null, cancelledAt: null, ...over,
});
const slot: Slot = {
  id: "dp_h1_2", horseId: "h1", riderUserId: "u-dp", riderName: null, weekday: 2, startTime: "18:00", endTime: "19:30",
  validFrom: new Date(2026, 10, 1), validUntil: null,
};

describe("dates", () => {
  it("un horodatage du serveur sans fuseau est lu en UTC", () => {
    expect(parseServerDate("2026-11-09T23:00:00").toISOString()).toBe("2026-11-09T23:00:00.000Z");
    expect(parseServerDate("2026-11-09 23:00:00").toISOString()).toBe("2026-11-09T23:00:00.000Z");
    expect(parseServerDate("2026-11-09T23:00:00+01:00").toISOString()).toBe("2026-11-09T22:00:00.000Z");
    expect(parseServerDate("2026-11-09T23:00:00.000Z").toISOString()).toBe("2026-11-09T23:00:00.000Z");
  });
  it("lundi de la semaine", () => {
    expect(weekStart(new Date(2026, 10, 15, 20)).getDate()).toBe(9);
  });
});

describe("buildWeek", () => {
  it("séances de la semaine + occurrences de créneaux, sans doublon ni annulée", () => {
    const written = session({ id: "dp_h1_2_2026-11-10", date: new Date(2026, 10, 10), time: "18:00", completed: true, riderUserId: "u-dp" });
    const items = buildWeek(
      [session(), written, session({ id: "x", cancelledAt: new Date() }), session({ id: "autre-semaine", date: new Date(2026, 10, 20) })],
      [slot],
      MON
    );
    expect(items.map((i) => i.id)).toEqual(["s1", "dp_h1_2_2026-11-10"]);
    expect(items[1]).toMatchObject({ done: true, fromSlot: true });
  });
  it("une occurrence non écrite vient du créneau", () => {
    const items = buildWeek([], [slot], MON);
    expect(items).toEqual([expect.objectContaining({ id: "dp_h1_2_2026-11-10", time: "18:00", riderUserId: "u-dp", fromSlot: true, done: false })]);
  });
  it("créneau terminé : plus d'occurrence", () => {
    expect(buildWeek([], [{ ...slot, validUntil: new Date(2026, 10, 9) }], MON)).toHaveLength(0);
  });
});

describe("riderLabel", () => {
  it("compte de l'équipe, nom libre, ou personne", () => {
    expect(riderLabel({ riderUserId: "u-dp", riderName: null }, team.h1)).toBe("Léa");
    expect(riderLabel({ riderUserId: null, riderName: " Inès " }, team.h1)).toBe("Inès");
    expect(riderLabel({ riderUserId: "parti", riderName: null }, team.h1)).toBeNull();
  });
});

describe("weekTasks", () => {
  const task: Task = { id: "t1", horseId: "h1", title: "Sortie au pré", assigneeUserId: "u-dp", assigneeName: null, weekdays: [1, 2], dueDate: null, time: "08:00", validFrom: new Date(2026, 10, 1), validUntil: null };
  it("occurrences de la semaine avec leur coche", () => {
    const rows = weekTasks([task], [{ id: "t1_2026-11-10", taskId: "t1", date: new Date(2026, 10, 10), doneByUserId: "u-dp" }], MON);
    expect(rows.map((r) => [r.day.getDate(), !!r.completion])).toEqual([[9, false], [10, true]]);
  });
});

describe("CSV", () => {
  it("échappe les séparateurs, guillemets et sauts de ligne", () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell("ligne\nsuite")).toBe('"ligne\nsuite"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });
  it("neutralise les formules (injection CSV)", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+33 6 12")).toBe("'+33 6 12");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-3)).toBe("-3");
  });
  it("BOM, séparateur « ; » et CRLF pour Excel", () => {
    expect(toCsv(["A", "B"], [[1, "x"]])).toBe("﻿A;B\r\n1;x\r\n");
  });
  it("planning et frais : colonnes et noms résolus", () => {
    const planning = planningCsv(buildWeek([], [slot], MON), horses, team);
    expect(planning).toContain("Date;Jour;Heure;Cheval;Cavalier;Fait;Créneau régulier");
    expect(planning).toContain("Tornade;Léa;non;oui");
    const fees = feesCsv([{ id: "f", horseId: "h1", payerUserId: null, payerName: "=Inès", month: "2026-11", amount: 150, paidAt: null }], horses, team);
    expect(fees).toContain("2026-11;Tornade;'=Inès;150,00;");
  });
});
