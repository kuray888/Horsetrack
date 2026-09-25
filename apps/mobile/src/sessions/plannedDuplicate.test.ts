import { describe, expect, it } from "vitest";
import { findPlannedSessionToComplete, type PlannedSession } from "@/sessions/plannedDuplicate";

const day = (n: number) => new Date(2026, 8, n);
const session = (id: string, horseId: string | null, date: Date, completed = false): PlannedSession => ({
  id,
  horseId,
  date,
  completed,
});

describe("findPlannedSessionToComplete", () => {
  const planned = session("s1", "a", day(22));

  it("retrouve la séance prévue le même jour pour le même cheval", () => {
    expect(findPlannedSessionToComplete([planned], ["a"], day(22), true)?.id).toBe("s1");
  });

  it("ignore l'heure : seule la journée compte", () => {
    const withTime = session("s1", "a", new Date(2026, 8, 22, 18, 30));
    expect(findPlannedSessionToComplete([withTime], ["a"], new Date(2026, 8, 22, 7, 0), true)?.id).toBe("s1");
  });

  it("ne propose rien quand la saisie planifie au lieu de constater", () => {
    // Deux séances le même jour (matin/soir) sont légitimes à la planification.
    expect(findPlannedSessionToComplete([planned], ["a"], day(22), false)).toBeNull();
  });

  it("ne propose rien pour un autre cheval ou un autre jour", () => {
    expect(findPlannedSessionToComplete([planned], ["b"], day(22), true)).toBeNull();
    expect(findPlannedSessionToComplete([planned], ["a"], day(23), true)).toBeNull();
  });

  it("ignore une séance déjà cochée", () => {
    expect(findPlannedSessionToComplete([session("s1", "a", day(22), true)], ["a"], day(22), true)).toBeNull();
  });

  it("s'abstient quand plusieurs séances pourraient correspondre", () => {
    const two = [planned, session("s2", "a", day(22))];
    expect(findPlannedSessionToComplete(two, ["a"], day(22), true)).toBeNull();
  });

  it("s'abstient dès que la saisie vise plusieurs chevaux", () => {
    const stable = [planned, session("s2", "b", day(22))];
    expect(findPlannedSessionToComplete(stable, ["a", "b"], day(22), true)).toBeNull();
  });

  it("s'abstient sans date et sans cheval visé", () => {
    expect(findPlannedSessionToComplete([planned], ["a"], null, true)).toBeNull();
    expect(findPlannedSessionToComplete([planned], [], day(22), true)).toBeNull();
  });
});
