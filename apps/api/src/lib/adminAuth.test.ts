import { afterEach, describe, expect, it } from "vitest";
import { isAdminAuthorized, isAdminConfigured } from "./adminAuth";

const basic = (s: string) => `Basic ${btoa(s)}`;

afterEach(() => {
  delete process.env.ADMIN_USER;
  delete process.env.ADMIN_PASSWORD;
});

describe("adminAuth", () => {
  it("reste fermé sans configuration ou avec un mot de passe trop court", () => {
    expect(isAdminConfigured()).toBe(false);
    expect(isAdminAuthorized(basic("a:b"))).toBe(false);
    process.env.ADMIN_USER = "anis";
    process.env.ADMIN_PASSWORD = "court";
    expect(isAdminAuthorized(basic("anis:court"))).toBe(false);
  });

  it("n'accepte que les bons identifiants", () => {
    process.env.ADMIN_USER = "anis";
    process.env.ADMIN_PASSWORD = "un-mot-de-passe-long";
    expect(isAdminAuthorized(basic("anis:un-mot-de-passe-long"))).toBe(true);
    expect(isAdminAuthorized(basic("anis:un-mot-de-passe-lonG"))).toBe(false);
    expect(isAdminAuthorized(basic("anis:un-mot-de-passe-long "))).toBe(false);
    expect(isAdminAuthorized("Bearer x")).toBe(false);
    expect(isAdminAuthorized("Basic %%%")).toBe(false);
    expect(isAdminAuthorized(null)).toBe(false);
  });
});
