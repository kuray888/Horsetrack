import { describe, expect, it } from "vitest";
import { formatWhen, greeting, weeklyRecapMessage } from "@/today/todayFormat";

describe("textes de l'Accueil", () => {
  const now = new Date(2026, 9, 28, 10, 0); // mercredi 28 octobre

  it("dit quand tombe un événement", () => {
    expect(formatWhen(new Date(2026, 9, 28), "18:00", now)).toBe("Aujourd'hui · 18:00");
    expect(formatWhen(new Date(2026, 9, 29), undefined, now)).toBe("Demain");
    expect(formatWhen(new Date(2026, 10, 4), "9:30", now)).toBe("Mer. 4 nov. · 9:30");
  });

  it("salue selon l'heure", () => {
    expect(greeting(new Date(2026, 9, 28, 8))).toBe("Bonjour");
    expect(greeting(new Date(2026, 9, 28, 14))).toBe("Bon après-midi");
    expect(greeting(new Date(2026, 9, 28, 20))).toBe("Bonsoir");
  });

  it("résume la semaine", () => {
    expect(weeklyRecapMessage(0, 0)).toBe("Aucune séance planifiée cette semaine.");
    expect(weeklyRecapMessage(0, 3)).toBe("La semaine commence — à toi de planifier la première séance !");
    expect(weeklyRecapMessage(1, 3)).toBe("1/3 séances faites cette semaine. Encore 2 pour finir en beauté.");
    expect(weeklyRecapMessage(3, 3)).toBe("Semaine parfaite ! Les 3 séances planifiées sont faites. 🎉");
  });
});
