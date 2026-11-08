import { describe, expect, it } from "vitest";
import {
  activeSlots,
  isoWeekday,
  occurrenceId,
  sessionForOccurrence,
  slotDuration,
  slotOccurrences,
  type RideSlot,
} from "./slots";
import type { TrainingSession } from "@/sessions/store";

const slot = (over: Partial<RideSlot> = {}): RideSlot => ({
  id: "dp_h1_2",
  horseId: "h1",
  riderUserId: "u-dp",
  riderName: null,
  weekday: 2,
  startTime: "18:00",
  endTime: "19:30",
  validFrom: new Date(2026, 10, 1),
  validUntil: null,
  kind: "DP",
  activityType: null,
  notes: "",
  updatedAt: "",
  ...over,
});

// Lundi 9 → dimanche 15 novembre 2026.
const MON = new Date(2026, 10, 9);
const SUN = new Date(2026, 10, 15);

describe("isoWeekday", () => {
  it("lundi = 1, dimanche = 7", () => {
    expect(isoWeekday(MON)).toBe(1);
    expect(isoWeekday(SUN)).toBe(7);
  });
});

describe("slotOccurrences", () => {
  it("un créneau du mardi donne une occurrence par semaine, à id stable", () => {
    const occ = slotOccurrences([slot()], [], MON, SUN);
    expect(occ).toHaveLength(1);
    expect(occ[0].id).toBe("dp_h1_2_2026-11-10");
    expect(occ[0].date.getDate()).toBe(10);
    expect(occ[0].session).toBeNull();
    expect(occurrenceId("dp_h1_2", new Date(2026, 10, 10, 23, 30))).toBe("dp_h1_2_2026-11-10");
  });

  it("respecte le début et la fin de validité", () => {
    expect(slotOccurrences([slot({ validFrom: new Date(2026, 10, 11) })], [], MON, SUN)).toHaveLength(0);
    expect(slotOccurrences([slot({ validUntil: new Date(2026, 10, 9) })], [], MON, SUN)).toHaveLength(0);
    expect(slotOccurrences([slot({ validUntil: new Date(2026, 10, 10) })], [], MON, SUN)).toHaveLength(1);
  });

  it("rattache la séance déjà écrite, cache une occurrence annulée", () => {
    const done = { ...sessionForOccurrence({ id: "dp_h1_2_2026-11-10", slot: slot(), date: new Date(2026, 10, 10), session: null }), completed: true };
    expect(slotOccurrences([slot()], [done], MON, SUN)[0].session?.completed).toBe(true);
    const cancelled: TrainingSession = { ...done, cancelledAt: new Date() };
    expect(slotOccurrences([slot()], [cancelled], MON, SUN)).toHaveLength(0);
  });

  it("une occurrence déplacée à un autre jour quitte le créneau", () => {
    const moved = {
      ...sessionForOccurrence({ id: "dp_h1_2_2026-11-10", slot: slot(), date: new Date(2026, 10, 10), session: null }),
      date: new Date(2026, 10, 12),
    };
    expect(slotOccurrences([slot()], [moved], MON, SUN)).toHaveLength(0);
  });

  it("triées par jour puis par heure", () => {
    const occ = slotOccurrences(
      [slot({ id: "b", weekday: 4, startTime: "08:00" }), slot({ id: "a", weekday: 4, startTime: "07:00" }), slot({ id: "c", weekday: 2 })],
      [],
      MON,
      SUN
    );
    expect(occ.map((o) => o.slot.id)).toEqual(["c", "a", "b"]);
  });
});

describe("sessionForOccurrence", () => {
  it("reprend cavalier, heure et durée du créneau", () => {
    const s = sessionForOccurrence({ id: "dp_h1_2_2026-11-10", slot: slot(), date: new Date(2026, 10, 10, 15), session: null });
    expect(s).toMatchObject({ id: "dp_h1_2_2026-11-10", horseId: "h1", riderUserId: "u-dp", time: "18:00", durationMinutes: 90, slotId: "dp_h1_2", completed: false });
    expect(s.date.getHours()).toBe(0);
  });
});

describe("slotDuration", () => {
  it("minutes entre deux heures, sinon null", () => {
    expect(slotDuration("18:00", "19:30")).toBe(90);
    expect(slotDuration("18:00", null)).toBeNull();
    expect(slotDuration("19:00", "18:00")).toBeNull();
  });
});

describe("activeSlots", () => {
  it("écarte les créneaux terminés, trie lundi → dimanche", () => {
    const list = activeSlots(
      [slot({ id: "fini", validUntil: new Date(2026, 10, 1) }), slot({ id: "jeu", weekday: 4 }), slot({ id: "lun", weekday: 1 })],
      MON
    );
    expect(list.map((s) => s.id)).toEqual(["lun", "jeu"]);
  });
});
