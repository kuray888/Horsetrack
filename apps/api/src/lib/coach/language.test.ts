import { describe, expect, it } from "vitest";
import { cachedSuggestionUsable, summaryNeedsTranslation } from "./language";

describe("idée de séance en cache", () => {
  it("même langue : servie", () => expect(cachedSuggestionUsable({ lang: "en" }, "en")).toBe(true));
  it("autre langue : refaite", () => expect(cachedSuggestionUsable({ lang: "fr" }, "en")).toBe(false));
  it("ancienne ligne sans langue : servie telle quelle", () => {
    expect(cachedSuggestionUsable({ reason: "…" }, "en")).toBe(true);
    expect(cachedSuggestionUsable(null, "en")).toBe(true);
  });
});

describe("résumé du mois", () => {
  it("terminé dans une autre langue : refait", () => {
    expect(summaryNeedsTranslation({ status: "DONE", lang: "fr" }, "en")).toBe(true);
  });
  it("terminé dans la bonne langue : gardé", () => {
    expect(summaryNeedsTranslation({ status: "DONE", lang: "en" }, "en")).toBe(false);
  });
  it("en préparation : on n'interrompt pas", () => {
    expect(summaryNeedsTranslation({ status: "PENDING", lang: "fr" }, "en")).toBe(false);
    expect(summaryNeedsTranslation({ status: "SUBMITTED", lang: "fr" }, "en")).toBe(false);
  });
});
