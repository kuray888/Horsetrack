import { describe, it, expect } from "vitest";
import { computeSessionStats, startOfMonth, endOfMonth } from "./stats";
import type { TrainingSession } from "./store";

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "s1",
    horseId: "h1",
    activityType: "dressage",
    date: new Date(2026, 8, 15),
    time: "09h00",
    durationMinutes: 60,
    intensity: "medium",
    notes: "",
    completed: true,
    ...overrides,
  };
}

describe("computeSessionStats", () => {
  const from = startOfMonth(new Date(2026, 8, 1));
  const to = endOfMonth(new Date(2026, 8, 1));

  it("ne compte que les séances faites, dans la période", () => {
    const sessions = [
      makeSession({ id: "a", completed: true, date: new Date(2026, 8, 5) }),
      makeSession({ id: "b", completed: false, date: new Date(2026, 8, 6) }),
      makeSession({ id: "c", completed: true, date: new Date(2026, 7, 20) }), // août, hors période
    ];
    const stats = computeSessionStats(sessions, from, to);
    expect(stats.sessionCount).toBe(1);
  });

  it("sépare repos et séances d'entraînement", () => {
    const sessions = [
      makeSession({ id: "a", activityType: "dressage" }),
      makeSession({ id: "b", activityType: "repos" }),
      makeSession({ id: "c", activityType: "repos" }),
    ];
    const stats = computeSessionStats(sessions, from, to);
    expect(stats.sessionCount).toBe(1);
    expect(stats.restDays).toBe(2);
  });

  it("calcule durée totale et moyenne en ignorant les séances sans durée", () => {
    const sessions = [
      makeSession({ id: "a", durationMinutes: 60 }),
      makeSession({ id: "b", durationMinutes: 30 }),
      makeSession({ id: "c", durationMinutes: null }),
    ];
    const stats = computeSessionStats(sessions, from, to);
    expect(stats.totalMinutes).toBe(90);
    expect(stats.avgMinutes).toBe(30); // 90 / 3 séances, pas / 2
  });

  it("répartit par discipline, triée par nombre décroissant", () => {
    const sessions = [
      makeSession({ id: "a", activityType: "dressage" }),
      makeSession({ id: "b", activityType: "cso" }),
      makeSession({ id: "c", activityType: "cso" }),
    ];
    const stats = computeSessionStats(sessions, from, to);
    expect(stats.perDiscipline).toEqual([
      { activityType: "cso", count: 2 },
      { activityType: "dressage", count: 1 },
    ]);
  });

  it("renvoie des totaux nuls sur une période sans séance", () => {
    const stats = computeSessionStats([], from, to);
    expect(stats).toEqual({
      sessionCount: 0,
      totalMinutes: 0,
      avgMinutes: 0,
      perWeek: 0,
      perDiscipline: [],
      restDays: 0,
    });
  });
});
