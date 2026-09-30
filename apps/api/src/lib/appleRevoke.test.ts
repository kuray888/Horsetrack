import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appleClientSecret } from "./appleRevoke";

describe("appleClientSecret", () => {
  it("produit un JWT ES256 vérifiable, au format attendu par Apple", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwt = appleClientSecret(
      {
        teamId: "TEAM123",
        keyId: "KEY456",
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        clientId: "com.horsetrack.app",
      },
      1_700_000_000
    );
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY456" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      iss: "TEAM123",
      iat: 1_700_000_000,
      exp: 1_700_000_300,
      aud: "https://appleid.apple.com",
      sub: "com.horsetrack.app",
    });
    // Signature JOSE (r||s) : 64 octets pour P-256, vérifiable telle quelle.
    const sig = Buffer.from(signature, "base64url");
    expect(sig).toHaveLength(64);
    expect(
      verify("sha256", Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, sig)
    ).toBe(true);
  });
});
