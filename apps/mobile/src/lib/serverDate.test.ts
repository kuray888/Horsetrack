import { describe, expect, it } from "vitest";
import { parseServerDate, parseServerDateOrNull } from "./serverDate";

// Fuseau à décalage non nul : une lecture en heure locale se verrait.
process.env.TZ = "Europe/Paris";

describe("parseServerDate", () => {
  it("lit en UTC un timestamp renvoyé sans fuseau (colonne timestamp(3))", () => {
    // 3 octobre 2026 à minuit à Paris, tel que stocké puis renvoyé par PostgREST.
    const d = parseServerDate("2026-10-02T22:00:00");
    expect(d.getTime()).toBe(new Date(2026, 9, 3).getTime());
    expect(d.toDateString()).toBe("Sat Oct 03 2026");
  });

  it("refait exactement l'aller-retour de toISOString, millisecondes comprises", () => {
    for (const local of [new Date(2026, 9, 3), new Date(2026, 9, 25, 23, 47, 12, 345), new Date(2027, 2, 28, 2, 30)]) {
      // Ce que Postgres renvoie : l'horloge UTC, sans « Z », zéros décimaux retirés.
      const returned = local.toISOString().replace("Z", "").replace(/\.?0+$/, "");
      expect(parseServerDate(returned).getTime()).toBe(local.getTime());
    }
  });

  it("respecte un fuseau explicite (timestamptz)", () => {
    expect(parseServerDate("2026-10-02T22:00:00+00:00").toISOString()).toBe("2026-10-02T22:00:00.000Z");
    expect(parseServerDate("2026-10-03T00:00:00+02:00").toISOString()).toBe("2026-10-02T22:00:00.000Z");
    expect(parseServerDate("2026-10-02T18:00:00-0400").toISOString()).toBe("2026-10-02T22:00:00.000Z");
    expect(parseServerDate("2026-10-02T22:00:00.5Z").toISOString()).toBe("2026-10-02T22:00:00.500Z");
  });

  it("accepte l'espace comme séparateur et les microsecondes", () => {
    expect(parseServerDate("2026-10-02 22:00:00.123456").toISOString()).toBe("2026-10-02T22:00:00.123Z");
  });

  it("lit une date seule comme minuit UTC", () => {
    expect(parseServerDate("2026-10-03").toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });

  it("rend le jour choisi quel que soit le fuseau du téléphone (Antilles, Afrique de l'Ouest, Réunion, Paris)", () => {
    try {
      for (const zone of ["America/Martinique", "Africa/Dakar", "Indian/Reunion", "Europe/Paris"]) {
        process.env.TZ = zone;
        const chosen = new Date(2026, 8, 24); // minuit sur ce téléphone
        const returned = chosen.toISOString().replace("Z", "").replace(/\.?0+$/, "");
        expect(parseServerDate(returned).getTime()).toBe(chosen.getTime());
        expect(parseServerDate(returned).toDateString()).toBe("Thu Sep 24 2026");
      }
    } finally {
      process.env.TZ = "Europe/Paris";
    }
  });

  it("null reste null", () => {
    expect(parseServerDateOrNull(null)).toBeNull();
    expect(parseServerDateOrNull(undefined)).toBeNull();
    expect(parseServerDateOrNull("2026-10-02T22:00:00")!.getTime()).toBe(new Date(2026, 9, 3).getTime());
  });
});
