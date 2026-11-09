import { describe, expect, it } from "vitest";
import { addMonths, feeId, monthKey, overdueFees, suggestedFee, summarizeMonth, type Fee } from "./feesModel";

const fee = (over: Partial<Fee> = {}): Fee => ({
  id: "f", horseId: "h1", payerUserId: null, payerName: "Léa", month: "2026-11", amount: 150, paidAt: null, notes: "", updatedAt: "", ...over,
});

describe("mois", () => {
  it("clé AAAA-MM et navigation d'un mois à l'autre", () => {
    expect(monthKey(new Date(2026, 10, 9))).toBe("2026-11");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("feeId", () => {
  it("stable pour un compte comme pour un simple nom", () => {
    expect(feeId("h1", "u-dp", null, "2026-11")).toBe("fee_h1_u-dp_2026-11");
    expect(feeId("h1", null, " Inès D. ", "2026-11")).toBe("fee_h1_n_in-s-d-_2026-11");
    expect(feeId("h1", null, "inès d.", "2026-11")).toBe(feeId("h1", null, "INÈS D.", "2026-11"));
  });
});

describe("summarizeMonth", () => {
  it("total, payé, reste à recevoir", () => {
    const s = summarizeMonth([fee({ amount: 150, paidAt: new Date() }), fee({ id: "g", payerName: "Inès", amount: 80.5 }), fee({ id: "x", month: "2026-10" })], "h1", "2026-11");
    expect(s).toEqual({ total: 230.5, paid: 150, due: 80.5, allPaid: false, count: 2 });
  });
  it("mois vide : jamais « tout payé »", () => {
    expect(summarizeMonth([], "h1", "2026-11")).toEqual({ total: 0, paid: 0, due: 0, allPaid: false, count: 0 });
  });
});

describe("suggestedFee", () => {
  const partnership = { riderName: "Léa", days: [2], monthlyFee: 150, notes: "" };
  it("propose la participation de la fiche tant que le mois est vide", () => {
    expect(suggestedFee(partnership, [], "h1", "2026-11")).toEqual({ payerName: "Léa", amount: 150 });
    expect(suggestedFee(partnership, [fee()], "h1", "2026-11")).toBeNull();
  });
  it("rien sans montant ni prénom", () => {
    expect(suggestedFee({ ...partnership, monthlyFee: null }, [], "h1", "2026-11")).toBeNull();
    expect(suggestedFee({ ...partnership, riderName: " " }, [], "h1", "2026-11")).toBeNull();
    expect(suggestedFee(null, [], "h1", "2026-11")).toBeNull();
  });
});

describe("overdueFees", () => {
  it("impayés des mois passés seulement, du plus ancien au plus récent", () => {
    const list = overdueFees([fee({ id: "a", month: "2026-10" }), fee({ id: "b", month: "2026-09" }), fee({ id: "c", month: "2026-11" }), fee({ id: "d", month: "2026-08", paidAt: new Date() })], "h1", "2026-11");
    expect(list.map((f) => f.id)).toEqual(["b", "a"]);
  });
});
