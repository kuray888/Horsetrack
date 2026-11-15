import { describe, expect, it } from "vitest";
import { MAX_AMOUNT, parseAmount } from "./parseAmount";

describe("parseAmount", () => {
  it("accepte la virgule comme le point", () => {
    expect(parseAmount("45,50")).toBe(45.5);
    expect(parseAmount("45.50")).toBe(45.5);
    expect(parseAmount("45")).toBe(45);
    expect(parseAmount(" 45,5 € ")).toBe(45.5);
  });
  it("accepte les séparateurs de milliers", () => {
    expect(parseAmount("1 234,50")).toBe(1234.5);
    expect(parseAmount("1 234,50")).toBe(1234.5);
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("1.234.567")).toBe(1234567);
  });
  it("arrondit au centime", () => {
    expect(parseAmount("45,555")).toBe(45.56);
  });
  it("refuse ce qui n'est pas un montant", () => {
    for (const bad of ["", "  ", "abc", "-5", "1e9", "Infinity", "0x10", "12,34,56,", "1,2.3,4", "--1", "12 euros"]) {
      expect(parseAmount(bad), bad).toBeNull();
    }
  });
  it("refuse un montant que la base ne saurait pas stocker", () => {
    expect(parseAmount("100000000")).toBeNull();
    expect(parseAmount(String(MAX_AMOUNT))).toBe(MAX_AMOUNT);
  });
});
