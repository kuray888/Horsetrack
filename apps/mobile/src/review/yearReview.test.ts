import { describe, expect, it } from "vitest";
import { computeYearReview, featuredReviewYear, hasYearReview } from "@/review/yearReview";
import type { ActivityType } from "@/agenda/activityKinds";

const d = (y: number, m: number, day: number) => new Date(y, m, day, 10);
const s = (date: Date, activityType: ActivityType = "dressage", patch: object = {}) => ({
  horseId: "h1",
  date,
  completed: true,
  durationMinutes: 60,
  activityType,
  ride: null,
  ...patch,
});

describe("computeYearReview", () => {
  const now = d(2026, 11, 20);
  const review = computeYearReview(
    {
      horseId: "h1",
      sessions: [
        s(d(2026, 2, 2)),
        s(d(2026, 2, 9), "balade", { ride: { distanceMeters: 12_400, gps: true } }),
        s(d(2026, 2, 16)),
        s(d(2026, 5, 1), "repos"),
        s(d(2026, 6, 1), "pansage"),
        s(d(2026, 7, 1), "dressage", { completed: false }),
        s(d(2025, 2, 1)),
        s(d(2026, 2, 3), "dressage", { horseId: "h2" }),
      ],
      appointments: [
        { horseId: "h1", date: d(2026, 4, 1), type: "concours", result: "2e" },
        { horseId: "h1", date: d(2026, 8, 1), type: "concours", result: null },
        { horseId: "h1", date: d(2026, 1, 1), type: "vaccination", result: null },
        { horseId: "h1", date: d(2026, 3, 1), type: "marechal", result: null },
      ],
      journal: [
        { horseId: "h1", date: d(2026, 3, 1), photoUri: "file:///a.jpg" },
        { horseId: "h1", date: d(2026, 3, 2), photoUri: null },
      ],
    },
    2026,
    now
  );

  it("ne compte que les séances faites de l'année, hors repos et pansage", () => {
    expect(review.sessions).toBe(3);
    expect(review.hours).toBe(3);
    expect(review.favoriteActivity).toBe("dressage");
    expect(review.busiestMonth).toBe(2);
  });

  it("additionne les kilomètres enregistrés au GPS", () => {
    expect(review.km).toBe(12);
  });

  it("garde la meilleure série de semaines de l'année", () => {
    expect(review.bestStreakWeeks).toBe(3);
  });

  it("concours, soins, souvenirs et photos", () => {
    expect(review.shows).toBe(2);
    expect(review.showResults).toEqual(["2e"]);
    expect(review.care).toBe(2);
    expect(review.memories).toBe(2);
    expect(review.photos).toBe(1);
    expect(hasYearReview(review)).toBe(true);
  });

  it("année vide : rien à montrer", () => {
    const empty = computeYearReview({ horseId: "h1", sessions: [], appointments: [], journal: [] }, 2026, now);
    expect(empty.favoriteActivity).toBeNull();
    expect(empty.busiestMonth).toBeNull();
    expect(hasYearReview(empty)).toBe(false);
  });
});

describe("featuredReviewYear", () => {
  it("de décembre à mi-janvier, le bilan de l'année qui se termine", () => {
    expect(featuredReviewYear(d(2026, 11, 1))).toBe(2026);
    expect(featuredReviewYear(d(2027, 0, 15))).toBe(2026);
    expect(featuredReviewYear(d(2027, 0, 16))).toBeNull();
    expect(featuredReviewYear(d(2026, 6, 1))).toBeNull();
  });
});
