import { describe, expect, it } from "vitest";
import { coachGate } from "./coachGate";

const status = (o: Partial<{ freeQuestionsLeft: number | null }> = {}) => ({
  available: true,
  premium: false,
  questionsLeft: 30,
  questionsLimit: 30,
  ...o,
});

describe("accès à l'écran du coach", () => {
  it("Premium : tout le coach", () => {
    expect(coachGate(true, null)).toBe("premium");
    expect(coachGate(true, status())).toBe("premium");
  });

  it("gratuit avec des questions offertes : il peut essayer", () => {
    expect(coachGate(false, status({ freeQuestionsLeft: 3 }))).toBe("free");
    expect(coachGate(false, status({ freeQuestionsLeft: 1 }))).toBe("free");
  });

  it("gratuit sans question restante, ou serveur ancien sans le champ : verrouillé", () => {
    expect(coachGate(false, status({ freeQuestionsLeft: 0 }))).toBe("locked");
    expect(coachGate(false, status())).toBe("locked");
  });

  it("statut pas encore reçu : on attend, sans afficher de verrou trompeur", () => {
    expect(coachGate(false, null)).toBe("loading");
  });

});
