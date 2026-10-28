import { describe, expect, it, vi } from "vitest";

vi.mock("expo-web-browser", () => ({}));
vi.mock("expo-linking", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/nativeInteraction", () => ({}));

const { parseAuthCallback } = await import("@/lib/googleAuth");

describe("parseAuthCallback", () => {
  it("lit le code PKCE", () => {
    expect(parseAuthCallback("horsetrack://auth-callback?code=abc123")).toEqual({ code: "abc123" });
  });

  it("lit les jetons du flux implicite", () => {
    expect(parseAuthCallback("horsetrack://auth-callback#access_token=a&refresh_token=r&expires_in=3600")).toEqual({
      accessToken: "a",
      refreshToken: "r",
    });
  });

  it("remonte l'erreur du fournisseur", () => {
    expect(parseAuthCallback("horsetrack://auth-callback?error=access_denied&error_description=Refus")).toEqual({
      error: "Refus",
    });
  });

  it("rien d'exploitable : null", () => {
    expect(parseAuthCallback("horsetrack://auth-callback")).toBeNull();
  });
});
