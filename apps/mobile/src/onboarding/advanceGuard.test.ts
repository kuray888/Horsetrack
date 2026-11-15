import { describe, expect, it } from "vitest";
import { createAdvanceGuard } from "@/onboarding/advanceGuard";

describe("createAdvanceGuard", () => {
  it("n'autorise qu'une seule avance, même si deux déclencheurs se suivent", () => {
    const guard = createAdvanceGuard();
    expect(guard.tryAdvance()).toBe(true);
    expect(guard.tryAdvance()).toBe(false);
    expect(guard.advanced).toBe(true);
  });

  it("autorise de nouveau après un retour sur l'écran", () => {
    const guard = createAdvanceGuard();
    guard.tryAdvance();
    guard.reset();
    expect(guard.advanced).toBe(false);
    expect(guard.tryAdvance()).toBe(true);
  });
});
