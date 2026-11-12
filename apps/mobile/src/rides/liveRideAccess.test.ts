import { describe, expect, it } from "vitest";
import { countOwnRides, liveRideAccess } from "./liveRideAccess";

describe("accès à la séance en direct (1.3.0)", () => {
  it("Premium : toujours", () => {
    expect(liveRideAccess({ isPremium: true, liveRideFree: false, ownRides: 12 })).toBe("allowed");
  });

  it("compte existant avant la 1.3.0 (ou base pas encore migrée) : rien ne change", () => {
    expect(liveRideAccess({ isPremium: false, liveRideFree: true, ownRides: 40 })).toBe("allowed");
    expect(liveRideAccess({ isPremium: false, liveRideFree: undefined, ownRides: 40 })).toBe("allowed");
    expect(liveRideAccess({ isPremium: false, liveRideFree: null, ownRides: 40 })).toBe("allowed");
  });

  it("nouveau compte gratuit : la première séance offerte, puis Premium", () => {
    expect(liveRideAccess({ isPremium: false, liveRideFree: false, ownRides: 0 })).toBe("first_free");
    expect(liveRideAccess({ isPremium: false, liveRideFree: false, ownRides: 1 })).toBe("locked");
  });

  it("ne compte que les parcours de ses propres chevaux", () => {
    const owned = new Set(["h1"]);
    const sessions = [
      { horseId: "h1", ride: { gps: true } },
      { horseId: "h1", ride: null },
      { horseId: "h2", ride: { gps: true } }, // cheval partagé avec lui
      { horseId: "h1" },
    ];
    expect(countOwnRides(sessions, owned)).toBe(1);
  });
});
