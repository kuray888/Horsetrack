import { describe, expect, it } from "vitest";
import { defaultInviteRole, inviteRoleAvailable } from "./shareRoles";

describe("rôles proposés à l'invitation", () => {
  it("Premium : tous les rôles, demi-pension par défaut", () => {
    expect(defaultInviteRole(true)).toBe("DEMI_PENSION");
    for (const r of ["DEMI_PENSION", "COACH", "GROOM", "VIEWER"] as const) expect(inviteRoleAvailable(r, true)).toBe(true);
  });

  it("gratuit : seulement la lecture seule, choisie d'office", () => {
    expect(defaultInviteRole(false)).toBe("VIEWER");
    expect(inviteRoleAvailable("VIEWER", false)).toBe(true);
    expect(inviteRoleAvailable("DEMI_PENSION", false)).toBe(false);
    expect(inviteRoleAvailable("COACH", false)).toBe(false);
  });
});
