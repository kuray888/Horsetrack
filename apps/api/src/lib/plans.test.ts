import { describe, expect, it } from "vitest";
import { tierFromEntitlementIds } from "./plans";

describe("tierFromEntitlementIds", () => {
  it("Pro l'emporte (les produits Pro portent aussi l'entitlement Premium)", () => {
    expect(tierFromEntitlementIds(["grand_prix", "ecurie_pro"])).toBe("PRO");
    expect(tierFromEntitlementIds(["ecurie_pro"])).toBe("PRO");
  });
  it("Premium seul", () => {
    expect(tierFromEntitlementIds(["grand_prix"])).toBe("GRAND_PRIX");
  });
  it("aucun palier payant", () => {
    expect(tierFromEntitlementIds([])).toBeNull();
    expect(tierFromEntitlementIds(["autre"])).toBeNull();
  });
});
