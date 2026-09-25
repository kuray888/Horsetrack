import { describe, it, expect } from "vitest";
import { extractRecoveryTokens, tokenIdentity } from "./passwordRecovery";

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("lien de réinitialisation", () => {
  it("extrait les jetons d'un lien de récupération", () => {
    expect(extractRecoveryTokens("horsetrack://reset-password#access_token=a&refresh_token=r&type=recovery")).toEqual({
      accessToken: "a",
      refreshToken: "r",
    });
    expect(extractRecoveryTokens("horsetrack://reset-password#access_token=a&refresh_token=r")).toBeNull();
  });

  it("lit le compte visé par le jeton", () => {
    const token = `${b64url({ alg: "HS256" })}.${b64url({ sub: "user-b", email: "b@exemple.fr" })}.signature`;
    expect(tokenIdentity(token)).toEqual({ userId: "user-b", email: "b@exemple.fr" });
  });

  it("ne plante pas sur un jeton illisible", () => {
    expect(tokenIdentity("pas-un-jwt")).toEqual({ userId: null, email: null });
    expect(tokenIdentity("a.%%%.c")).toEqual({ userId: null, email: null });
  });
});
