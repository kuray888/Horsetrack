import { describe, expect, it } from "vitest";
import { createRateLimiter, secretMatches } from "./rateLimit";

describe("secretMatches", () => {
  it("accepte le bon secret Bearer", () => {
    expect(secretMatches("Bearer abc", "abc")).toBe(true);
  });
  it("refuse un secret faux, vide, absent ou de longueur différente", () => {
    expect(secretMatches("Bearer abd", "abc")).toBe(false);
    expect(secretMatches("Bearer ", "abc")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
    expect(secretMatches("Bearer abcd", "abc")).toBe(false);
  });
  it("refuse tout quand le secret attendu n'est pas configuré", () => {
    expect(secretMatches("Bearer ", undefined)).toBe(false);
    expect(secretMatches("Bearer undefined", undefined)).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("bloque au-delà du plafond dans la fenêtre puis repart", () => {
    let now = 0;
    const limit = createRateLimiter({ max: 3, windowMs: 1000, now: () => now });
    expect([1, 2, 3].map(() => limit("u"))).toEqual([true, true, true]);
    expect(limit("u")).toBe(false);
    expect(limit("autre")).toBe(true);
    now = 1001;
    expect(limit("u")).toBe(true);
  });
});
