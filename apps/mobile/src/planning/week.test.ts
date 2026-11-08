import { describe, expect, it } from "vitest";
import { myPlan, planWarnings, weekPlan, weekStart, type PlanContext } from "./week";
import type { TrainingSession } from "@/sessions/store";
import type { RideSlot } from "./slots";

const MON = new Date(2026, 10, 9);
const day = (n: number) => new Date(2026, 10, 9 + n);

let seq = 0;
const session = (over: Partial<TrainingSession> = {}): TrainingSession => ({
  id: `s${++seq}`,
  horseId: "h1",
  activityType: "dressage",
  customActivityLabel: null,
  date: MON,
  time: "",
  durationMinutes: 45,
  intensity: "medium",
  notes: "",
  completed: false,
  ...over,
});

const slot: RideSlot = {
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
};

const NONE: PlanContext = { injuredHorseIds: new Set(), competitions: [] };
const codes = (items: ReturnType<typeof weekPlan>, ctx = NONE) => planWarnings(items, ctx).map((w) => w.code);

describe("weekStart", () => {
  it("lundi de la semaine, dimanche compris", () => {
    expect(weekStart(new Date(2026, 10, 15, 20)).getDate()).toBe(9);
    expect(weekStart(MON).getDate()).toBe(9);
  });
});

describe("weekPlan", () => {
  it("séances de la semaine + occurrences pas encore écrites, sans doublon", () => {
    const written = session({ id: "dp_h1_2_2026-11-10", date: day(1), time: "18:00", completed: true, slotId: "dp_h1_2" });
    const items = weekPlan([session({ id: "lundi", date: day(0) }), written, session({ date: day(8) })], [slot], MON);
    expect(items.map((i) => i.id)).toEqual(["lundi", "dp_h1_2_2026-11-10"]);
    expect(items[1].completed).toBe(true);
  });

  it("une occurrence non écrite porte son créneau", () => {
    const items = weekPlan([], [slot], MON);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ riderUserId: "u-dp", time: "18:00", durationMinutes: 90, session: null });
    expect(items[0].occurrence?.slot.id).toBe("dp_h1_2");
  });

  it("ignore les séances annulées", () => {
    expect(weekPlan([session({ cancelledAt: new Date() })], [], MON)).toHaveLength(0);
  });
});

describe("myPlan", () => {
  it("ce qu'on m'a attribué, et mes chevaux sans cavalier", () => {
    const items = weekPlan(
      [
        session({ id: "a", riderUserId: "u-dp" }),
        session({ id: "b", riderUserId: "u-coach" }),
        session({ id: "c" }),
        session({ id: "d", horseId: "h2" }),
        session({ id: "e", riderName: "Inès" }),
      ],
      [],
      MON
    );
    expect(myPlan(items, "u-dp", new Set()).map((i) => i.id)).toEqual(["a"]);
    expect(myPlan(items, "u-owner", new Set(["h1"])).map((i) => i.id)).toEqual(["c"]);
  });
});

describe("planWarnings", () => {
  it("même cheval réservé deux fois sur des horaires qui se chevauchent", () => {
    const items = weekPlan([session({ date: day(1), time: "18:30", durationMinutes: 45 })], [slot], MON);
    expect(codes(items)).toContain("horse_overlap");
  });

  it("pas de chevauchement sans heure, ni l'une après l'autre", () => {
    expect(codes(weekPlan([session({ date: day(1) })], [slot], MON))).not.toContain("horse_overlap");
    expect(codes(weekPlan([session({ date: day(1), time: "19:30" })], [slot], MON))).not.toContain("horse_overlap");
  });

  it("un cavalier à deux endroits à la fois", () => {
    const items = weekPlan([session({ horseId: "h2", date: day(1), time: "18:00", riderUserId: "u-dp" })], [slot], MON);
    expect(codes(items)).toContain("rider_overlap");
  });

  it("6 jours de travail : trop ; 7 : aucun repos", () => {
    const six = Array.from({ length: 6 }, (_, i) => session({ date: day(i) }));
    expect(codes(weekPlan(six, [], MON))).toEqual(["too_many"]);
    const seven = Array.from({ length: 7 }, (_, i) => session({ date: day(i) }));
    expect(codes(weekPlan(seven, [], MON))).toEqual(["no_rest"]);
  });

  it("le repos et le pansage ne comptent pas comme du travail", () => {
    const week = Array.from({ length: 7 }, (_, i) => session({ date: day(i), activityType: i === 3 ? "repos" : "dressage" }));
    expect(codes(weekPlan(week, [], MON))).toEqual(["too_many"]);
  });

  it("deux séances éprouvantes en 3 jours", () => {
    const items = weekPlan([session({ date: day(0), activityType: "cso" }), session({ date: day(2), intensity: "high" })], [], MON);
    expect(codes(items)).toEqual(["hard_streak"]);
    const spaced = weekPlan([session({ date: day(0), activityType: "cso" }), session({ date: day(4), intensity: "high" })], [], MON);
    expect(codes(spaced)).toEqual([]);
  });

  it("cheval blessé : séances prévues signalées", () => {
    const items = weekPlan([session({ id: "prevue", date: day(0) }), session({ date: day(1), completed: true })], [], MON);
    const w = planWarnings(items, { ...NONE, injuredHorseIds: new Set(["h1"]) });
    expect(w).toEqual([expect.objectContaining({ code: "injured", itemIds: ["prevue"] })]);
  });

  it("concours : travail le jour même, séance éprouvante la veille", () => {
    const items = weekPlan([session({ date: day(4), activityType: "cso" }), session({ date: day(5) })], [], MON);
    const w = codes(items, { ...NONE, competitions: [{ horseId: "h1", start: day(5), end: day(5) }] });
    expect(w).toEqual(["competition_near", "competition_day"]);
  });
});
