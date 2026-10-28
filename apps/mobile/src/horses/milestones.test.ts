import { describe, it, expect } from "vitest";
import { bestWeeklyStreak, computeMilestones, newlyUnlocked, nextMilestone } from "./milestones";

const now = new Date(2026, 9, 27, 12);
const done = (date: Date, minutes = 60, horseId = "h1") => ({ horseId, date, completed: true, durationMinutes: minutes });
const weeksAgo = (n: number) => new Date(2026, 9, 27 - n * 7, 10);

describe("bestWeeklyStreak", () => {
  it("garde la meilleure série, même interrompue depuis", () => {
    const sessions = [done(weeksAgo(10)), done(weeksAgo(9)), done(weeksAgo(8)), done(weeksAgo(7)), done(weeksAgo(2))];
    expect(bestWeeklyStreak(sessions, "h1", now)).toBe(4);
  });
  it("ignore les séances non faites et les autres chevaux", () => {
    const sessions = [done(weeksAgo(1), 60, "h2"), { ...done(weeksAgo(0)), completed: false }];
    expect(bestWeeklyStreak(sessions, "h1", now)).toBe(0);
  });
});

describe("computeMilestones", () => {
  it("débloque sur des faits réels, sans rien perdre", () => {
    const sessions = Array.from({ length: 12 }, (_, i) => done(weeksAgo(i), 60));
    const ms = computeMilestones({ horseId: "h1", sessions, now });
    const byId = Object.fromEntries(ms.map((x) => [x.id, x]));
    expect(byId["sessions-10"].unlocked).toBe(true);
    expect(byId["sessions-50"].unlocked).toBe(false);
    expect(byId["sessions-50"].current).toBe(12);
    expect(byId["hours-10"].unlocked).toBe(true);
    expect(byId["streak-12"].unlocked).toBe(true);
  });

  it("compte concours, soins, souvenirs et ancienneté", () => {
    const appointments = [
      { horseId: "h1", date: new Date(2025, 8, 1), type: "concours" },
      { horseId: "h1", date: new Date(2026, 1, 1), type: "vaccination" },
      { horseId: "h1", date: new Date(2027, 0, 1), type: "concours" }, // futur : pas encore
    ];
    const ms = computeMilestones({ horseId: "h1", sessions: [], appointments, journal: [{ horseId: "h1" }], now });
    const byId = Object.fromEntries(ms.map((x) => [x.id, x]));
    expect(byId["competition-1"].unlocked).toBe(true);
    expect(byId["competition-10"].current).toBe(1);
    expect(byId["together-365"].unlocked).toBe(true);
    expect(byId["journal-10"].current).toBe(1);
  });
});

describe("newlyUnlocked / nextMilestone", () => {
  it("repère le jalon franchi par une séance cochée", () => {
    const nine = Array.from({ length: 9 }, (_, i) => done(new Date(2026, 9, 1 + i)));
    const before = computeMilestones({ horseId: "h1", sessions: nine, now });
    const after = computeMilestones({ horseId: "h1", sessions: [...nine, done(new Date(2026, 9, 20))], now });
    expect(newlyUnlocked(before, after).map((x) => x.id)).toEqual(["sessions-10", "hours-10"]);
  });
  it("propose le jalon le plus proche", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => done(new Date(2026, 9, 1 + i), 30));
    expect(nextMilestone(computeMilestones({ horseId: "h1", sessions, now }))?.id).toBe("sessions-10");
  });
});
