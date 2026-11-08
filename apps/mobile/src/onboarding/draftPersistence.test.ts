import { describe, expect, it } from "vitest";
import { hasResumableDraft, reviveDraft } from "./draftPersistence";
import type { HorseDraft } from "./store";

function makeHorse(isPrimary: boolean): HorseDraft {
  return {
    localId: "neuf",
    name: "",
    photoUrl: null,
    birthYear: null,
    sex: null,
    breed: null,
    coat: null,
    heightCm: null,
    weightKg: null,
    discipline: null,
    level: null,
    fitnessLevel: null,
    workload: null,
    strengths: [],
    weaknesses: [],
    temperament: [],
    healthConditions: [],
    restDayActivities: [],
    injuries: [],
    isPrimary,
  };
}

/** Aller-retour comme sur l'appareil : JSON.stringify puis JSON.parse. */
const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("reviveDraft", () => {
  it("restaure un brouillon, dates comprises", () => {
    const occurredAt = new Date("2026-03-04T00:00:00.000Z");
    const saved = {
      rider: { level: "AMATEUR", mainDiscipline: "DRESSAGE", rideFrequency: null, primaryGoal: null },
      horses: [{ ...makeHorse(true), localId: "a", name: "Tornade", injuries: [{ localId: "i", type: "Tendon", occurredAt, recoveryStatus: "RECOVERED", note: "" }] }],
      editingIndex: 0,
      flow: "owner",
    };
    const draft = reviveDraft(roundTrip(saved), makeHorse)!;
    expect(draft.horses[0].name).toBe("Tornade");
    expect(draft.horses[0].injuries[0].occurredAt?.getTime()).toBe(occurredAt.getTime());
    expect(draft.rider.level).toBe("AMATEUR");
    expect(draft.flow).toBe("owner");
  });

  it("complète les champs ajoutés depuis la sauvegarde", () => {
    const { restDayActivities: _omit, ...old } = { ...makeHorse(true), localId: "a", name: "Tornade" };
    const draft = reviveDraft({ rider: {}, horses: [old], editingIndex: 0 }, makeHorse)!;
    expect(draft.horses[0].restDayActivities).toEqual([]);
    expect(draft.flow).toBeNull();
  });

  it("ignore ce qui n'est pas un brouillon", () => {
    for (const raw of [null, "x", [], {}, { rider: {}, horses: [] }, { rider: {}, horses: [{ name: "sans id" }] }]) {
      expect(reviveDraft(raw, makeHorse)).toBeNull();
    }
  });

  it("garde un cheval principal et un index valide", () => {
    const draft = reviveDraft(
      { rider: {}, horses: [{ ...makeHorse(false), localId: "a" }, { ...makeHorse(false), localId: "b" }], editingIndex: 9 },
      makeHorse
    )!;
    expect(draft.horses[0].isPrimary).toBe(true);
    expect(draft.editingIndex).toBe(1);
  });
});

describe("hasResumableDraft", () => {
  it("seulement s'il y a un cheval nommé", () => {
    expect(hasResumableDraft({ horses: [makeHorse(true)] })).toBe(false);
    expect(hasResumableDraft({ horses: [{ ...makeHorse(true), name: "  Tornade " }] })).toBe(true);
  });
});
