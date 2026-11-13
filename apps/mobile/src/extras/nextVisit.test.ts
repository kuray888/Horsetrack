import { describe, it, expect } from "vitest";
import { mapsUrl, nextVisitFor } from "./nextVisit";
import type { Contact } from "./model";

const contact = (role: Contact["role"], name = "Paul"): Contact => ({ id: "c1", name, role, phone: "", email: "", notes: "", address: "", updatedAt: "" });
const appt = (type: string, date: string, professional: string | null = null) => ({ type, date: new Date(date), professional });
const NOW = new Date("2026-11-13T10:00:00");

describe("nextVisitFor", () => {
  it("maréchal : dernière visite + 7 semaines", () => {
    const r = nextVisitFor(contact("marechal"), [contact("marechal")], [appt("marechal", "2026-10-01", "Paul")], NOW)!;
    expect(r.last.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(r.suggested.toISOString().slice(0, 10)).toBe("2026-11-19");
    expect(r.overdue).toBe(false);
  });
  it("en retard quand la date conseillée est passée", () => {
    const r = nextVisitFor(contact("marechal"), [contact("marechal")], [appt("marechal", "2026-08-01", "Paul")], NOW)!;
    expect(r.overdue).toBe(true);
  });
  it("dentiste : un an", () => {
    const r = nextVisitFor(contact("dentiste", "Léa"), [contact("dentiste", "Léa")], [appt("dentiste", "2026-03-01", "Léa")], NOW)!;
    expect(r.suggested.toISOString().slice(0, 10)).toBe("2027-03-01");
  });
  it("prend la visite la plus récente, ignore les rendez-vous à venir et ceux d'un autre pro", () => {
    const paul = contact("marechal");
    const autre = { ...contact("marechal", "Autre"), id: "c2" };
    const r = nextVisitFor(
      paul,
      [paul, autre],
      [appt("marechal", "2026-09-01", "Paul"), appt("marechal", "2026-10-15", "Paul"), appt("marechal", "2026-12-01", "Paul"), appt("marechal", "2026-11-01", "Autre")],
      NOW
    )!;
    expect(r.last.toISOString().slice(0, 10)).toBe("2026-10-15");
  });
  it("rien pour un métier sans rythme (véto, coach…) ou sans visite passée", () => {
    expect(nextVisitFor(contact("veto"), [contact("veto")], [appt("veto", "2026-10-01")], NOW)).toBeNull();
    expect(nextVisitFor(contact("marechal"), [contact("marechal")], [], NOW)).toBeNull();
  });
});

describe("mapsUrl", () => {
  it("itinéraire Plans, adresse encodée ; rien sans adresse", () => {
    expect(mapsUrl("12 rue du Haras, 49400 Saumur")).toBe("http://maps.apple.com/?daddr=12%20rue%20du%20Haras%2C%2049400%20Saumur");
    expect(mapsUrl("   ")).toBeNull();
  });
});
