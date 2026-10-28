import { describe, expect, it } from "vitest";
import { estimateCostUsd, toMicros } from "@/lib/coach/cost";

describe("coût d'un appel", () => {
  it("additionne entrée, sortie et cache aux tarifs de Haiku 5.5", () => {
    const usd = estimateCostUsd({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(0.1 + 0.5 + 0.01 + 0.125, 6);
  });

  it("divise par deux en lot, et se range en millionièmes de dollar", () => {
    const usd = estimateCostUsd({ input_tokens: 2000, output_tokens: 400 }, true);
    expect(usd).toBeCloseTo((2000 * 0.1 + 400 * 0.5) / 1e6 / 2, 9);
    expect(toMicros(0.000412)).toBe(412);
  });
});
