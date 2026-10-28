import { describe, expect, it } from "vitest";
import {
  EMPTY_IDENTITY,
  EMPTY_PARTNERSHIP,
  hasPartnership,
  isPartnerDay,
  isoWeekday,
  netMonthlyCost,
  contactForAppointment,
  emptyFeeding,
  hasFeeding,
  hasIdentity,
  isPlausibleMicrochip,
  isPlausibleSire,
  isPlausibleUeln,
  mergeByUpdatedAt,
  normalizeDetails,
  suggestedContacts,
  telUrl,
  type Contact,
} from "@/extras/model";

const MEALS: [string, string, string] = ["Matin", "Midi", "Soir"];
const contact = (patch: Partial<Contact>): Contact => ({
  id: "c1",
  name: "Dr Martin",
  role: "veto",
  phone: "06 12 34 56 78",
  email: "",
  notes: "",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...patch,
});

describe("identité", () => {
  it("accepte les formats usuels, espaces et tirets compris", () => {
    expect(isPlausibleSire("25012345K")).toBe(true);
    expect(isPlausibleSire("25 012 345 k")).toBe(true);
    expect(isPlausibleSire("2501234")).toBe(false);
    expect(isPlausibleUeln("250001A12345678")).toBe(true);
    expect(isPlausibleUeln("250-001")).toBe(false);
    expect(isPlausibleMicrochip("250 25 9600 123456")).toBe(true);
    expect(isPlausibleMicrochip("12345")).toBe(false);
  });

  it("un champ vide n'est jamais une erreur", () => {
    expect(isPlausibleSire("")).toBe(true);
    expect(hasIdentity(EMPTY_IDENTITY)).toBe(false);
    expect(hasIdentity({ ...EMPTY_IDENTITY, stable: "Écurie du Val" })).toBe(true);
  });
});

describe("alimentation", () => {
  it("part de trois repas vides", () => {
    const plan = emptyFeeding(MEALS);
    expect(plan.meals.map((m) => m.label)).toEqual(MEALS);
    expect(hasFeeding(plan)).toBe(false);
    expect(hasFeeding({ ...plan, hay: "À volonté" })).toBe(true);
  });

  it("relit une ligne incomplète ou abîmée sans planter", () => {
    const d = normalizeDetails("h1", { identity: { sire: "25012345K", ueln: 42 }, feeding: { meals: [null, { label: "Matin", ration: "2 kg" }] } }, MEALS);
    expect(d.identity.sire).toBe("25012345K");
    expect(d.identity.ueln).toBe("");
    expect(d.feeding.meals).toEqual([{ id: "m1", label: "Matin", ration: "2 kg" }]);
    expect(normalizeDetails("h2", null, MEALS).feeding.meals).toHaveLength(3);
  });
});

describe("demi-pension", () => {
  it("relit jours et participation en écartant les valeurs invalides", () => {
    const d = normalizeDetails("h1", { partnership: { riderName: "Léa", days: [3, 1, 9, 1, "x"], monthlyFee: -5 } }, MEALS);
    expect(d.partnership).toEqual({ riderName: "Léa", days: [1, 3], monthlyFee: null, notes: "" });
  });

  it("dit si c'est le jour de la DP", () => {
    const p = { riderName: "Léa", days: [1, 3], monthlyFee: 150, notes: "" };
    expect(isPartnerDay(p, new Date(2026, 9, 26))).toBe(true); // lundi
    expect(isPartnerDay(p, new Date(2026, 9, 27))).toBe(false); // mardi
    expect(isPartnerDay({ ...p, riderName: "" }, new Date(2026, 9, 26))).toBe(false);
    expect(isoWeekday(new Date(2026, 10, 1))).toBe(7); // dimanche
  });

  it("calcule le reste à charge, jamais négatif", () => {
    const p = { riderName: "Léa", days: [], monthlyFee: 150, notes: "" };
    expect(netMonthlyCost(420.5, p)).toBe(270.5);
    expect(netMonthlyCost(100, p)).toBe(0);
    expect(hasPartnership(EMPTY_PARTNERSHIP)).toBe(false);
  });
});

describe("contacts", () => {
  it("ne compose que des chiffres", () => {
    expect(telUrl("06 12 34 56 78")).toBe("tel:0612345678");
    expect(telUrl("+33 6 12 34 56 78")).toBe("tel:+33612345678");
    expect(telUrl("abc")).toBeNull();
  });

  it("retrouve le contact d'un rendez-vous par son nom, sans accents ni casse", () => {
    const list = [contact({}), contact({ id: "c2", name: "Éric Durand", role: "marechal" })];
    expect(contactForAppointment(list, { type: "autre", professional: "eric durand" })?.id).toBe("c2");
  });

  it("sinon, le seul contact du bon métier", () => {
    const list = [contact({}), contact({ id: "c2", name: "Éric", role: "marechal" })];
    expect(contactForAppointment(list, { type: "vaccination", professional: null })?.id).toBe("c1");
    const twoVets = [...list, contact({ id: "c3", name: "Dr Bis" })];
    expect(contactForAppointment(twoVets, { type: "veto", professional: "" })).toBeNull();
  });

  it("propose le bon métier en premier", () => {
    const list = [contact({ id: "a", name: "Zoé", role: "coach" }), contact({ id: "b", name: "Bruno", role: "marechal" })];
    expect(suggestedContacts(list, "marechal").map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("mergeByUpdatedAt", () => {
  const key = (c: Contact) => c.id;
  const T = Date.parse("2026-10-27T10:00:00.000Z");

  it("la version la plus récente gagne", () => {
    const local = [contact({ name: "Ancien", updatedAt: "2026-10-01T00:00:00.000Z" })];
    const remote = [contact({ name: "Nouveau", updatedAt: "2026-10-02T00:00:00.000Z" })];
    expect(mergeByUpdatedAt(local, remote, key, new Set(), T)[0].name).toBe("Nouveau");
  });

  it("une modification en attente d'envoi n'est pas écrasée", () => {
    const local = [contact({ name: "Local", updatedAt: "2026-10-01T00:00:00.000Z" })];
    const remote = [contact({ name: "Serveur", updatedAt: "2026-10-05T00:00:00.000Z" })];
    expect(mergeByUpdatedAt(local, remote, key, new Set(["c1"]), T)[0].name).toBe("Local");
  });

  it("supprimé ailleurs : retiré, sauf s'il vient d'être créé ici", () => {
    const old = contact({ updatedAt: "2026-10-01T00:00:00.000Z" });
    const fresh = contact({ id: "c9", updatedAt: "2026-10-27T10:00:01.000Z" });
    expect(mergeByUpdatedAt([old, fresh], [], key, new Set(), T).map((c) => c.id)).toEqual(["c9"]);
  });

  it("keepMissing garde une fiche jamais arrivée sur le serveur", () => {
    const old = contact({ updatedAt: "2026-10-01T00:00:00.000Z" });
    expect(mergeByUpdatedAt([old], [], key, new Set(), T, true)).toEqual([old]);
  });

  it("ajoute ce qui n'existe que sur le serveur", () => {
    expect(mergeByUpdatedAt([], [contact({ id: "r" })], key, new Set(), T).map((c) => c.id)).toEqual(["r"]);
  });
});
