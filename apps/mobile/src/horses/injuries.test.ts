import { describe, expect, it } from "vitest";
import {
  isInjuryOpen,
  markInjuryRecovered,
  recoveryAlertMessage,
  sortInjuriesRecentFirst,
  type InjuryRecord,
} from "./injuries";

const injury = (over: Partial<InjuryRecord> & { id: string }): InjuryRecord => ({
  type: "Tendinite",
  occurredAt: null,
  recoveryStatus: "RECOVERED",
  note: "",
  ...over,
});

describe("sortInjuriesRecentFirst", () => {
  it("place la plus récente d'abord", () => {
    const sorted = sortInjuriesRecentFirst([
      injury({ id: "old", occurredAt: new Date(2022, 0, 1) }),
      injury({ id: "new", occurredAt: new Date(2025, 5, 1) }),
      injury({ id: "mid", occurredAt: new Date(2023, 3, 1) }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["new", "mid", "old"]);
  });

  it("met les blessures sans date à la fin, dans leur ordre d'origine", () => {
    const sorted = sortInjuriesRecentFirst([
      injury({ id: "undated-1" }),
      injury({ id: "dated", occurredAt: new Date(2020, 0, 1) }),
      injury({ id: "undated-2" }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["dated", "undated-1", "undated-2"]);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const input = [injury({ id: "a", occurredAt: new Date(2020, 0, 1) }), injury({ id: "b", occurredAt: new Date(2024, 0, 1) })];
    sortInjuriesRecentFirst(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("isInjuryOpen / markInjuryRecovered", () => {
  it("considère ouverte toute blessure non rétablie, y compris sans statut", () => {
    expect(isInjuryOpen(injury({ id: "1", recoveryStatus: "IN_PROGRESS" }))).toBe(true);
    expect(isInjuryOpen(injury({ id: "2", recoveryStatus: "ONGOING" }))).toBe(true);
    expect(isInjuryOpen(injury({ id: "3", recoveryStatus: null }))).toBe(true);
    expect(isInjuryOpen(injury({ id: "4", recoveryStatus: "RECOVERED" }))).toBe(false);
  });

  it("ne rétablit que la blessure visée", () => {
    const list = [injury({ id: "a", recoveryStatus: "IN_PROGRESS" }), injury({ id: "b", recoveryStatus: "IN_PROGRESS" })];
    const next = markInjuryRecovered(list, "a");
    expect(next.map((i) => i.recoveryStatus)).toEqual(["RECOVERED", "IN_PROGRESS"]);
    expect(list[0].recoveryStatus).toBe("IN_PROGRESS");
  });
});

describe("recoveryAlertMessage", () => {
  it("ne dit rien sans récupération en cours", () => {
    expect(recoveryAlertMessage([])).toBeNull();
    expect(recoveryAlertMessage([injury({ id: "1", recoveryStatus: "RECOVERED" })])).toBeNull();
  });

  it("n'alerte pas pour une séquelle à surveiller : état chronique, pas une urgence", () => {
    expect(recoveryAlertMessage([injury({ id: "1", recoveryStatus: "ONGOING" })])).toBeNull();
  });

  it("nomme la blessure quand il n'y en a qu'une", () => {
    expect(recoveryAlertMessage([injury({ id: "1", type: "Entorse", recoveryStatus: "IN_PROGRESS" })])).toBe(
      "Récupération en cours : Entorse"
    );
  });

  it("compte les blessures quand il y en a plusieurs", () => {
    const list = [
      injury({ id: "1", recoveryStatus: "IN_PROGRESS" }),
      injury({ id: "2", recoveryStatus: "IN_PROGRESS" }),
      injury({ id: "3", recoveryStatus: "RECOVERED" }),
    ];
    expect(recoveryAlertMessage(list)).toBe("2 blessures en cours de récupération");
  });
});
