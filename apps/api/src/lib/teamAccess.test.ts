import { describe, expect, it } from "vitest";
import { canHandleRole, teamActor } from "./teamAccess";

const horse = {
  owner: { userId: "owner" },
  collaborators: [
    { collaboratorUserId: "gerant", role: "MANAGER", status: "ACCEPTED" },
    { collaboratorUserId: "futur", role: "MANAGER", status: "PENDING" },
    { collaboratorUserId: "dp", role: "DEMI_PENSION", status: "ACCEPTED" },
  ],
};

describe("teamActor", () => {
  it("propriétaire, gérant accepté, sinon personne", () => {
    expect(teamActor(horse, "owner")).toBe("owner");
    expect(teamActor(horse, "gerant")).toBe("manager");
    expect(teamActor(horse, "futur")).toBeNull();
    expect(teamActor(horse, "dp")).toBeNull();
    expect(teamActor(horse, "inconnu")).toBeNull();
  });
});

describe("canHandleRole", () => {
  it("le gérant gère tout sauf les gérants", () => {
    expect(canHandleRole("manager", "GROOM")).toBe(true);
    expect(canHandleRole("manager", "MANAGER")).toBe(false);
    expect(canHandleRole("owner", "MANAGER")).toBe(true);
    expect(canHandleRole(null, "GROOM")).toBe(false);
  });
});
