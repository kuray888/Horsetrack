import { describe, it, expect } from "vitest";
import { previousMonthRecap, recapLines, recapShareText, shouldShowMonthlyRecap, weekStart, weeklyStreak } from "./progress";

const s = (date: Date, completed = true, durationMinutes: number | null = 45, horseId = "h1") => ({
  horseId,
  date,
  completed,
  durationMinutes,
});

describe("weekStart", () => {
  it("renvoie le lundi 00:00", () => {
    const d = weekStart(new Date(2026, 8, 27, 15)); // dimanche 27 sept.
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(0);
  });
});

describe("weeklyStreak", () => {
  const now = new Date(2026, 8, 25, 12); // vendredi

  it("compte les semaines consécutives avec au moins une séance faite", () => {
    const sessions = [s(new Date(2026, 8, 22)), s(new Date(2026, 8, 16)), s(new Date(2026, 8, 9))];
    expect(weeklyStreak(sessions, "h1", now)).toBe(3);
  });

  it("ne casse pas la série si la semaine en cours n'a pas encore de séance", () => {
    const sessions = [s(new Date(2026, 8, 16)), s(new Date(2026, 8, 9))];
    expect(weeklyStreak(sessions, "h1", now)).toBe(2);
  });

  it("s'arrête au premier trou, ignore les séances non faites, futures ou d'un autre cheval", () => {
    const sessions = [
      s(new Date(2026, 8, 22)),
      s(new Date(2026, 8, 2)),
      s(new Date(2026, 8, 15), false),
      s(new Date(2026, 8, 16), true, 30, "h2"),
      s(new Date(2026, 8, 29)),
    ];
    expect(weeklyStreak(sessions, "h1", now)).toBe(1);
  });

  it("traverse un changement d'heure sans se tromper de semaine", () => {
    const n = new Date(2026, 10, 4, 12);
    const sessions = [s(new Date(2026, 10, 3)), s(new Date(2026, 9, 27)), s(new Date(2026, 9, 20))];
    expect(weeklyStreak(sessions, "h1", n)).toBe(3);
  });
});

describe("bilan du mois", () => {
  const now = new Date(2026, 9, 3); // 3 octobre
  const sessions = [s(new Date(2026, 8, 3), true, 60), s(new Date(2026, 8, 10), true, 45), s(new Date(2026, 8, 12), false), s(new Date(2026, 9, 1))];
  const appts = [
    { horseId: "h1", date: new Date(2026, 8, 20), type: "concours" },
    { horseId: "h1", date: new Date(2026, 8, 5), type: "marechal" },
    { horseId: "h1", date: new Date(2026, 8, 6), type: "autre" },
  ];

  it("résume le mois précédent", () => {
    const recap = previousMonthRecap(sessions, appts, "h1", now);
    expect(recap).toEqual({ month: 8, year: 2026, sessionsDone: 2, totalMinutes: 105, competitions: 1, healthCare: 1 });
    expect(recapLines(recap)).toEqual(["2 séances (1 h 45)", "1 concours", "1 soin suivi"]);
  });

  it("gère le passage d'année", () => {
    const recap = previousMonthRecap([s(new Date(2025, 11, 20))], [], "h1", new Date(2026, 0, 2));
    expect(recap.month).toBe(11);
    expect(recap.year).toBe(2025);
    expect(recap.sessionsDone).toBe(1);
  });

  it("ne s'affiche que la première semaine du mois, et s'il y a quelque chose à dire", () => {
    const recap = previousMonthRecap(sessions, appts, "h1", now);
    expect(shouldShowMonthlyRecap(recap, now)).toBe(true);
    expect(shouldShowMonthlyRecap(recap, new Date(2026, 9, 12))).toBe(false);
    const empty = previousMonthRecap([], [], "h1", now);
    expect(shouldShowMonthlyRecap(empty, now)).toBe(false);
  });

  it("produit un texte partageable avec le lien", () => {
    const recap = previousMonthRecap(sessions, appts, "h1", now);
    const text = recapShareText(recap, "Tornado", "https://exemple.fr/telecharger");
    expect(text.startsWith("Septembre avec Tornado")).toBe(true);
    expect(text).toContain("https://exemple.fr/telecharger");
  });
});
