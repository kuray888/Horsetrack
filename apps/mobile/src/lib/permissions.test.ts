import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  can,
  canCreateAppointment,
  canWriteAppointment,
  canWriteJournal,
  canWriteSession,
  isMine,
  isMySession,
  quickAddAllowed,
  roleOf,
  type Capability,
  type HorseRole,
} from "./permissions";

/** Matrice telle qu'écrite dans rls.sql (horse_role_can), qui fait foi. */
function sqlMatrix(): Record<string, string[]> {
  const sql = readFileSync(join(__dirname, "../../../../packages/db/prisma/rls.sql"), "utf8");
  const start = sql.indexOf("create or replace function public.horse_role_can");
  const body = sql.slice(start, sql.indexOf("$$;", start));
  const matrix: Record<string, string[]> = {};
  for (const m of body.matchAll(/when '(\w+)'\s+then _role in \(([^)]*)\)/g)) {
    matrix[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((r) => r[1]).sort();
  }
  return matrix;
}

describe("matrice des droits", () => {
  it("identique à celle de la base (rls.sql)", () => {
    const fromSql = sqlMatrix();
    const fromApp = Object.fromEntries(
      Object.entries(CAPABILITIES).map(([cap, roles]) => [cap, [...roles].sort()])
    );
    expect(Object.keys(fromSql).length).toBeGreaterThan(10);
    expect(fromApp).toEqual(fromSql);
  });

  it("le propriétaire peut tout", () => {
    for (const cap of Object.keys(CAPABILITIES) as Capability[]) expect(can("OWNER", cap)).toBe(true);
  });

  it("sans rôle, rien", () => {
    expect(can(null, "read")).toBe(false);
  });
});

describe("les siens", () => {
  const me = "u-dp";
  it("créé sur cet appareil (pas encore relu) = à moi", () => {
    expect(isMine(undefined, me)).toBe(true);
    expect(isMine(me, me)).toBe(true);
    expect(isMine(null, me)).toBe(false);
    expect(isMine("u-autre", me)).toBe(false);
    expect(isMine("u-autre", null)).toBe(false);
  });

  it("une demi-pension modifie ses séances, pas celles des autres", () => {
    expect(canWriteSession("DEMI_PENSION", me, me)).toBe(true);
    expect(canWriteSession("DEMI_PENSION", null, me)).toBe(false);
    expect(canWriteSession("COACH", null, me)).toBe(true);
    expect(canWriteSession("GROOM", me, me)).toBe(false);
  });

  it("soins : le groom les siens, la demi-pension aucun", () => {
    expect(canWriteAppointment("GROOM", "VERMIFUGE", "u-groom", "u-groom")).toBe(true);
    expect(canWriteAppointment("GROOM", "VERMIFUGE", null, "u-groom")).toBe(false);
    expect(canWriteAppointment("DEMI_PENSION", "VETO", undefined, me)).toBe(false);
    expect(canWriteAppointment("MANAGER", "VETO", null, "u-gerant")).toBe(true);
  });

  it("concours : le coach oui, le groom non", () => {
    expect(canWriteAppointment("COACH", "CONCOURS", null, "u-coach")).toBe(true);
    expect(canWriteAppointment("GROOM", "CONCOURS", "u-groom", "u-groom")).toBe(false);
    expect(canWriteAppointment("GROOM", "concours", "u-groom", "u-groom")).toBe(false);
    expect(canCreateAppointment("COACH", "VETO")).toBe(false);
    expect(canCreateAppointment("VET", "VETO")).toBe(true);
  });

  it("journal : chacun le sien, le gérant tout", () => {
    expect(canWriteJournal("RIDER", me, me)).toBe(true);
    expect(canWriteJournal("RIDER", "u-autre", me)).toBe(false);
    expect(canWriteJournal("MANAGER", "u-autre", "u-gerant")).toBe(true);
  });
});

describe("roleOf", () => {
  it("propriétaire si le cheval n'est pas partagé", () => {
    expect(roleOf(null)).toBe<HorseRole>("OWNER");
    expect(roleOf("GROOM")).toBe<HorseRole>("GROOM");
    expect(roleOf(undefined)).toBeNull();
  });
});

describe("quickAddAllowed", () => {
  it("le « + » ne propose que ce que le rôle permet", () => {
    expect(quickAddAllowed("DEMI_PENSION", "seance")).toBe(true);
    expect(quickAddAllowed("DEMI_PENSION", "depense")).toBe(false);
    expect(quickAddAllowed("DEMI_PENSION", "soin")).toBe(false);
    expect(quickAddAllowed("GROOM", "soin")).toBe(true);
    expect(quickAddAllowed("GROOM", "seance")).toBe(false);
    expect(quickAddAllowed("COACH", "concours")).toBe(true);
    expect(quickAddAllowed("VET", "cheval")).toBe(true);
  });
  it("sans cheval (aucun encore créé) : tout, comme un propriétaire", () => {
    expect(quickAddAllowed(null, "depense")).toBe(true);
  });
});

describe("isMySession", () => {
  it("rappels : mes chevaux, et mes séances sur un cheval partagé", () => {
    expect(isMySession("OWNER", { createdByUserId: "u-dp" }, "u-owner")).toBe(true);
    expect(isMySession("DEMI_PENSION", { createdByUserId: null }, "u-dp")).toBe(false);
    expect(isMySession("DEMI_PENSION", { createdByUserId: "u-dp" }, "u-dp")).toBe(true);
    expect(isMySession("COACH", { createdByUserId: undefined }, "u-coach")).toBe(true);
  });
  it("séance attribuée : seulement à son cavalier", () => {
    expect(isMySession("DEMI_PENSION", { createdByUserId: null, riderUserId: "u-dp" }, "u-dp")).toBe(true);
    expect(isMySession("OWNER", { createdByUserId: null, riderUserId: "u-dp" }, "u-owner")).toBe(false);
    expect(isMySession("OWNER", { createdByUserId: null, riderName: "Inès" }, "u-owner")).toBe(false);
  });
});

describe("ancien partage (LEGACY) : les abonnés gardent ce que leurs invités faisaient", () => {
  it("roleOf : un partage d'avant les rôles est LEGACY, un propriétaire reste OWNER", () => {
    expect(roleOf("DEMI_PENSION", true)).toBe("LEGACY");
    expect(roleOf("DEMI_PENSION", false)).toBe("DEMI_PENSION");
    expect(roleOf(null, true)).toBe("OWNER");
  });
  it("tout ce qu'une demi-pension faisait avant reste permis", () => {
    for (const cap of ["read", "edit_details", "manage_sessions", "own_sessions", "manage_care", "add_care", "manage_competitions", "manage_journal", "add_journal", "manage_expenses"] as const) {
      expect(can("LEGACY", cap)).toBe(true);
    }
    expect(canWriteSession("LEGACY", "u-owner", "u-dp")).toBe(true);
    expect(canWriteAppointment("LEGACY", "VETO", null, "u-dp")).toBe(true);
    expect(quickAddAllowed("LEGACY", "depense")).toBe(true);
  });
  it("mais jamais l'équipe, ni les nouveautés réservées au propriétaire et au gérant", () => {
    for (const cap of ["manage_sharing", "moderate", "manage_planning", "manage_fees"] as const) {
      expect(can("LEGACY", cap)).toBe(false);
    }
  });
  it("rappels de séance : toutes les séances sans cavalier attribué, comme avant", () => {
    expect(isMySession("LEGACY", { createdByUserId: null }, "u-dp")).toBe(true);
  });
});
