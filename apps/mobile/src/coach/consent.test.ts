import { describe, expect, it, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => ({ disk: new Map<string, unknown>() }));
vi.mock("@/lib/localStore", () => ({
  readJson: async (key: string, fallback: unknown) => (store.disk.has(key) ? store.disk.get(key) : fallback),
  writeJson: async (key: string, value: unknown) => {
    store.disk.set(key, value);
    return true;
  },
}));

import { __resetCoachConsentForTests, clearCoachConsent, hasCoachConsent, loadCoachConsent, setCoachConsent } from "./consent";

beforeEach(() => {
  store.disk.clear();
  __resetCoachConsentForTests();
});

describe("accord pour le coach IA", () => {
  it("sans accord enregistré : refusé", async () => {
    await loadCoachConsent();
    expect(hasCoachConsent("u1")).toBe(false);
  });

  it("aucun compte : refusé", async () => {
    await loadCoachConsent();
    expect(hasCoachConsent(null)).toBe(false);
  });

  it("accordé pour un compte : valable pour lui seulement", async () => {
    await setCoachConsent("u1", true);
    expect(hasCoachConsent("u1")).toBe(true);
    expect(hasCoachConsent("u2")).toBe(false);
  });

  it("l'accord survit à un redémarrage (relu depuis le fichier)", async () => {
    await setCoachConsent("u1", true);
    __resetCoachConsentForTests();
    await loadCoachConsent();
    expect(hasCoachConsent("u1")).toBe(true);
  });

  it("retirable à tout moment", async () => {
    await setCoachConsent("u1", true);
    await setCoachConsent("u1", false);
    expect(hasCoachConsent("u1")).toBe(false);
    __resetCoachConsentForTests();
    await loadCoachConsent();
    expect(hasCoachConsent("u1")).toBe(false);
  });

  it("effacé avec les données de l'appareil (suppression du compte)", async () => {
    await setCoachConsent("u1", true);
    await clearCoachConsent();
    expect(hasCoachConsent("u1")).toBe(false);
  });

  it("un fichier abîmé ne donne jamais un accord", async () => {
    store.disk.set("coach_consent_v1", "n'importe quoi");
    await loadCoachConsent();
    expect(hasCoachConsent("u1")).toBe(false);
  });
});
