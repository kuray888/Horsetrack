import { describe, expect, it } from "vitest";
import { healthTileTone } from "./healthTileTone";

const today = new Date(2026, 10, 14);

describe("healthTileTone", () => {
  it("calme sans échéance", () => {
    expect(healthTileTone(null, today)).toBe("calm");
  });

  it("à surveiller dans les 14 jours, comme l'alerte de l'Accueil", () => {
    expect(healthTileTone(new Date(2026, 10, 14), today)).toBe("due_soon");
    expect(healthTileTone(new Date(2026, 10, 28), today)).toBe("due_soon");
  });

  it("calme au-delà", () => {
    expect(healthTileTone(new Date(2026, 10, 29), today)).toBe("calm");
  });
});
