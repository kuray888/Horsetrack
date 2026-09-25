import { describe, it, expect } from "vitest";
import {
  annualSavingsPercent,
  formatDayMonth,
  formatFullDate,
  joinNames,
  orderedBenefits,
  PAYWALL_PLACEMENTS,
  shouldShowRemindersUpsell,
  parsePlacement,
  parseTrialPeriod,
  paywallCopy,
  trialDurationLabel,
  trialEndDate,
  trialReminderDate,
} from "./paywallLogic";

describe("annualSavingsPercent", () => {
  it("arrondit l'économie à l'entier inférieur (jamais surestimée)", () => {
    // 39,99 / (3,99 × 12 = 47,88) → 16,48 % d'économie
    expect(annualSavingsPercent(3.99, 39.99)).toBe(16);
  });

  it("renvoie null sans économie réelle ou sans prix", () => {
    expect(annualSavingsPercent(3.99, 47.88)).toBeNull();
    expect(annualSavingsPercent(3.99, 60)).toBeNull();
    expect(annualSavingsPercent(0, 39.99)).toBeNull();
  });
});

describe("essai", () => {
  it("lit la période d'essai du store", () => {
    expect(parseTrialPeriod("MONTH", 1)).toEqual({ unit: "MONTH", count: 1 });
    expect(parseTrialPeriod("day", 7)).toEqual({ unit: "DAY", count: 7 });
    expect(parseTrialPeriod(null, 1)).toBeNull();
    expect(parseTrialPeriod("MONTH", 0)).toBeNull();
    expect(parseTrialPeriod("FORTNIGHT", 1)).toBeNull();
  });

  it("libelle la durée en français", () => {
    expect(trialDurationLabel({ unit: "MONTH", count: 1 })).toBe("1 mois");
    expect(trialDurationLabel({ unit: "DAY", count: 7 })).toBe("7 jours");
    expect(trialDurationLabel({ unit: "WEEK", count: 2 })).toBe("2 semaines");
    expect(trialDurationLabel({ unit: "YEAR", count: 1 })).toBe("1 an");
  });

  it("calcule la fin d'essai en mois calendaires", () => {
    const start = new Date(2026, 8, 25, 10, 0);
    const end = trialEndDate(start, { unit: "MONTH", count: 1 });
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(9);
    expect(end.getDate()).toBe(25);
  });

  it("prévient 3 jours avant la fin, sinon la veille, jamais dans le passé", () => {
    const now = new Date(2026, 8, 25, 10, 0);
    const inAMonth = new Date(2026, 9, 25, 10, 0);
    expect(trialReminderDate(inAMonth, now)?.getDate()).toBe(22);

    const inTwoDays = new Date(2026, 8, 27, 10, 0);
    expect(trialReminderDate(inTwoDays, now)?.getDate()).toBe(26);

    const inTwelveHours = new Date(2026, 8, 25, 22, 0);
    expect(trialReminderDate(inTwelveHours, now)).toBeNull();
  });
});

describe("dates", () => {
  it("omet l'année courante et écrit « 1er »", () => {
    const now = new Date(2026, 8, 25);
    expect(formatDayMonth(new Date(2026, 9, 25), now)).toBe("25 octobre");
    expect(formatDayMonth(new Date(2027, 0, 1), now)).toBe("1er janvier 2027");
    expect(formatFullDate(new Date(2026, 9, 25))).toBe("25 octobre 2026");
  });
});

describe("textes du paywall", () => {
  it("a un titre pour chaque contexte", () => {
    for (const p of PAYWALL_PLACEMENTS) {
      const copy = paywallCopy(p, ["Tornado"]);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.subtitle.length).toBeGreaterThan(0);
    }
  });

  it("personnalise l'onboarding selon le nombre de chevaux", () => {
    expect(paywallCopy("onboarding", ["Tornado"]).title).toBe("Ne rate plus aucun soin de Tornado.");
    expect(paywallCopy("onboarding", ["Tornado", "Ulysse"]).title).toBe("Garde Tornado et Ulysse dans ton écurie.");
    expect(paywallCopy("onboarding", []).title).toBe("Ne rate plus aucun soin de ton cheval.");
  });

  it("remonte le bénéfice du contexte en tête", () => {
    expect(orderedBenefits("sharing")[0]).toBe("sharing");
    expect(orderedBenefits("budget", 6)).toHaveLength(6);
    expect(new Set(orderedBenefits("budget", 6)).size).toBe(6);
    expect(orderedBenefits("profile")[0]).toBe("horses");
  });

  it("retombe sur « profile » pour un contexte inconnu", () => {
    expect(parsePlacement("sharing")).toBe("sharing");
    expect(parsePlacement("n'importe quoi")).toBe("profile");
    expect(parsePlacement(undefined)).toBe("profile");
  });

  it("énumère les prénoms", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B", "C"])).toBe("A, B et C");
    expect(joinNames(["A", "B", "C", "D", "E"])).toBe("A, B et 3 autres");
  });
});

describe("shouldShowRemindersUpsell", () => {
  const now = new Date(2026, 8, 25);
  it("ne s'affiche qu'aux comptes gratuits avec au moins 3 rendez-vous santé", () => {
    expect(shouldShowRemindersUpsell({ premium: false, healthAppointments: 3, dismissedAt: null, now })).toBe(true);
    expect(shouldShowRemindersUpsell({ premium: false, healthAppointments: 2, dismissedAt: null, now })).toBe(false);
    expect(shouldShowRemindersUpsell({ premium: true, healthAppointments: 10, dismissedAt: null, now })).toBe(false);
  });

  it("reste masquée 14 jours après une fermeture", () => {
    const tenDaysAgo = new Date(2026, 8, 15);
    const twentyDaysAgo = new Date(2026, 8, 5);
    expect(shouldShowRemindersUpsell({ premium: false, healthAppointments: 5, dismissedAt: tenDaysAgo, now })).toBe(false);
    expect(shouldShowRemindersUpsell({ premium: false, healthAppointments: 5, dismissedAt: twentyDaysAgo, now })).toBe(true);
  });
});
