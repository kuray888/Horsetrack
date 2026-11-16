import { describe, expect, it } from "vitest";
import { APPOINTMENT_TYPES, appointmentTypeFromServer, creatableAppointmentTypes } from "@/agenda/appointmentTypes";

describe("appointmentTypeFromServer", () => {
  it("relit les types connus, quelle que soit la casse", () => {
    expect(appointmentTypeFromServer("OSTEO")).toBe("osteo");
    expect(appointmentTypeFromServer("MASSEUR")).toBe("masseur");
    expect(appointmentTypeFromServer("vaccination")).toBe("vaccination");
  });
  it("un type inconnu devient « autre » au lieu de faire planter l'affichage", () => {
    expect(appointmentTypeFromServer("PHYSIO")).toBe("autre");
    expect(appointmentTypeFromServer(null)).toBe("autre");
    expect(appointmentTypeFromServer(undefined)).toBe("autre");
  });
  it("la liste ne contient pas de doublon", () => {
    expect(new Set(APPOINTMENT_TYPES).size).toBe(APPOINTMENT_TYPES.length);
  });
});


describe("creatableAppointmentTypes", () => {
  it("« Masseur équin » n'est pas proposé à la création en 1.3.0 : une app 1.2.0 qui partage le cheval planterait", () => {
    expect(creatableAppointmentTypes(null)).not.toContain("masseur");
    expect(creatableAppointmentTypes("veto")).not.toContain("masseur");
    expect(creatableAppointmentTypes(null)).toContain("osteo");
  });
  it("un rendez-vous déjà « masseur » garde son type quand on le modifie", () => {
    expect(creatableAppointmentTypes("masseur")).toContain("masseur");
  });
});
