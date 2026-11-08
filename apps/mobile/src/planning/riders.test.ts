import { describe, expect, it } from "vitest";
import { assignableRiders, riderColumns, riderDisplayName, sessionAccess, type TeamMember } from "./riders";

const team: TeamMember[] = [
  { userId: "u-owner", name: "Camille", role: "OWNER" },
  { userId: "u-dp", name: "Léa", role: "DEMI_PENSION" },
  { userId: "u-coach", name: "Marc", role: "COACH" },
];

describe("sessionAccess", () => {
  it("la DP coche la séance qu'on lui a attribuée, sans pouvoir la modifier", () => {
    expect(sessionAccess("DEMI_PENSION", { riderUserId: "u-dp", createdByUserId: "u-owner" }, "u-dp")).toBe("done");
  });
  it("sa propre séance : tout", () => {
    expect(sessionAccess("DEMI_PENSION", { riderUserId: "u-dp", createdByUserId: "u-dp" }, "u-dp")).toBe("full");
  });
  it("la séance d'un autre : rien", () => {
    expect(sessionAccess("DEMI_PENSION", { riderUserId: "u-coach", createdByUserId: "u-owner" }, "u-dp")).toBe("none");
    expect(sessionAccess("GROOM", { riderUserId: null, createdByUserId: null }, "u-groom")).toBe("none");
  });
  it("hors connexion avant lecture du compte : jamais « fait » par erreur", () => {
    expect(sessionAccess("DEMI_PENSION", { riderUserId: "u-dp", createdByUserId: "u-owner" }, null)).toBe("none");
  });
  it("coach et propriétaire : tout", () => {
    expect(sessionAccess("COACH", { riderUserId: "u-dp", createdByUserId: "u-owner" }, "u-coach")).toBe("full");
    expect(sessionAccess("OWNER", { riderUserId: "u-dp", createdByUserId: "u-dp" }, "u-owner")).toBe("full");
  });
});

describe("riderDisplayName", () => {
  it("toi, un membre, un nom libre, ou personne", () => {
    expect(riderDisplayName({ riderUserId: "u-dp" }, team, "u-dp", "Toi")).toBe("Toi");
    expect(riderDisplayName({ riderUserId: "u-dp" }, team, "u-owner", "Toi")).toBe("Léa");
    expect(riderDisplayName({ riderName: "  Inès " }, team, "u-owner", "Toi")).toBe("Inès");
    expect(riderDisplayName({}, team, "u-owner", "Toi")).toBeNull();
  });
  it("équipe pas encore chargée : pas de nom inventé", () => {
    expect(riderDisplayName({ riderUserId: "u-dp" }, [], "u-owner", "Toi")).toBeNull();
  });
});

describe("assignableRiders", () => {
  it("le coach attribue à toute l'équipe, soi en premier", () => {
    expect(assignableRiders("COACH", team, "u-coach").map((m) => m.userId)).toEqual(["u-coach", "u-owner", "u-dp"]);
  });
  it("la DP seulement à elle-même", () => {
    expect(assignableRiders("DEMI_PENSION", team, "u-dp").map((m) => m.userId)).toEqual(["u-dp"]);
  });
});

describe("riderColumns", () => {
  it("un compte l'emporte, un nom vide vaut personne", () => {
    expect(riderColumns("u-dp", "Inès")).toEqual({ riderUserId: "u-dp", riderName: null });
    expect(riderColumns(null, "  Inès ")).toEqual({ riderUserId: null, riderName: "Inès" });
    expect(riderColumns(null, "  ")).toEqual({ riderUserId: null, riderName: null });
  });
});
