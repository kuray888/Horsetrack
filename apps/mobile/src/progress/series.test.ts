import { describe, expect, it } from "vitest";
import { barHeights, linePoints, comparePeriods, regularity, weeklySeries, weightTrend, type SessionLike } from "./series";

const s = (y: number, m: number, d: number, minutes: number | null, extra: Partial<SessionLike> = {}): SessionLike => ({
  horseId: "h1",
  date: new Date(y, m - 1, d, 10),
  durationMinutes: minutes,
  intensity: "medium",
  completed: true,
  ...extra,
});

// Jeudi 12 novembre 2026 ; lundi de cette semaine : 9 novembre.
const NOW = new Date(2026, 10, 12, 18);

describe("progression : séries hebdomadaires", () => {
  it("une valeur par semaine (lundi), semaines vides comprises, de la plus ancienne à l'actuelle", () => {
    const points = weeklySeries([s(2026, 11, 10, 45), s(2026, 11, 3, 30, { intensity: "high" })], "h1", NOW, 4);
    expect(points.map((p) => p.weekStart.getDate())).toEqual([19, 26, 2, 9]);
    expect(points.map((p) => p.minutes)).toEqual([0, 0, 30, 45]);
    expect(points.map((p) => p.sessions)).toEqual([0, 0, 1, 1]);
    // Charge = minutes × intensité (légère 1, modérée 1,5, intense 2).
    expect(points.map((p) => p.load)).toEqual([0, 0, 60, 67.5]);
  });

  it("ne compte que les séances faites, de ce cheval, déjà passées", () => {
    const points = weeklySeries(
      [
        s(2026, 11, 10, 45, { completed: false }),
        s(2026, 11, 10, 20, { horseId: "h2" }),
        s(2026, 11, 14, 60), // samedi à venir
        s(2026, 11, 11, null), // durée inconnue : comptée comme séance, 0 minute
      ],
      "h1",
      NOW,
      1
    );
    expect(points).toEqual([expect.objectContaining({ minutes: 0, sessions: 1, load: 0 })]);
  });

  it("régularité : semaines actives et série en cours (la semaine en cours ne casse pas la série)", () => {
    const points = weeklySeries([s(2026, 10, 20, 30), s(2026, 10, 27, 30), s(2026, 11, 3, 30)], "h1", NOW, 6);
    expect(regularity(points)).toEqual({ activeWeeks: 3, totalWeeks: 6, currentStreak: 3 });
    const withThisWeek = weeklySeries([s(2026, 11, 3, 30), s(2026, 11, 10, 30)], "h1", NOW, 4);
    expect(regularity(withThisWeek).currentStreak).toBe(2);
    expect(regularity(weeklySeries([], "h1", NOW, 4))).toEqual({ activeWeeks: 0, totalWeeks: 4, currentStreak: 0 });
  });

  it("compare la période récente à la précédente, sans pourcentage absurde quand la précédente est vide", () => {
    const points = weeklySeries([s(2026, 10, 20, 60), s(2026, 11, 3, 90)], "h1", NOW, 4);
    expect(comparePeriods(points, 2)).toEqual({ current: 90, previous: 60, deltaPct: 50 });
    const fromNothing = weeklySeries([s(2026, 11, 3, 90)], "h1", NOW, 4);
    expect(comparePeriods(fromNothing, 2).deltaPct).toBeNull();
  });
});

describe("progression : poids", () => {
  const m = (y: number, mo: number, d: number, kg: number) => ({ date: new Date(y, mo - 1, d), weightKg: kg });

  it("écart entre la première et la dernière pesée de la période", () => {
    const trend = weightTrend([m(2026, 7, 1, 500), m(2026, 9, 1, 506), m(2026, 11, 1, 512), m(2026, 1, 1, 480)], NOW, 6);
    expect(trend).toEqual({ firstKg: 500, lastKg: 512, deltaKg: 12, count: 3 });
  });

  it("moins de deux pesées : pas de tendance", () => {
    expect(weightTrend([m(2026, 11, 1, 512)], NOW, 6)).toBeNull();
    expect(weightTrend([], NOW, 6)).toBeNull();
  });
});

describe("barHeights", () => {
  it("proportionnelles au maximum, semaine vide à 0, minimum 3 px", () => {
    expect(barHeights([0, 30, 60], 60)).toEqual([0, 30, 60]);
    expect(barHeights([1, 600], 60)).toEqual([3, 60]);
  });
  it("aucune donnée : rien à dessiner", () => {
    expect(barHeights([0, 0], 60)).toEqual([0, 0]);
    expect(barHeights([], 60)).toEqual([]);
  });
});

describe("linePoints", () => {
  it("la valeur la plus haute est en haut, étalée sur la largeur", () => {
    const p = linePoints([500, 510], 100, 40, 4);
    expect(p[0]).toEqual({ x: 4, y: 36 });
    expect(p[1]).toEqual({ x: 96, y: 4 });
  });
  it("valeurs identiques : ligne au milieu ; un point : centré", () => {
    expect(linePoints([500, 500], 100, 40).map((p) => p.y)).toEqual([20, 20]);
    expect(linePoints([500], 100, 40)[0].x).toBe(50);
    expect(linePoints([], 100, 40)).toEqual([]);
  });
});
