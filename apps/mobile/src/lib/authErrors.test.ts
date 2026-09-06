import { describe, expect, it } from "vitest";
import { isEmailAlreadyRegisteredError, isEmailNotConfirmedError } from "@/lib/authErrors";

/**
 * Régression : le bouton "Création..." restait bloqué indéfiniment sur
 * l'inscription (cf. audit du 2026-09-06) — la cause réelle était l'absence
 * de try/catch/finally autour de createAccount(), pas la classification
 * d'erreur elle-même. Mais la correction dépend aussi de distinguer
 * correctement "email pas confirmé" (-> écran de vérification) d'un "email
 * déjà utilisé" (-> message d'erreur classique) : ce test couvre cette
 * distinction pour ne pas régresser silencieusement si le texte d'erreur
 * Supabase change de formulation.
 */
describe("isEmailNotConfirmedError", () => {
  it("détecte le message Supabase réel", () => {
    expect(isEmailNotConfirmedError("Email not confirmed")).toBe(true);
  });

  it("est insensible à la casse", () => {
    expect(isEmailNotConfirmedError("EMAIL NOT CONFIRMED")).toBe(true);
  });

  it("ne confond pas une erreur d'email déjà utilisé avec un email non confirmé", () => {
    expect(isEmailNotConfirmedError("User already registered")).toBe(false);
  });

  it("ne matche pas une erreur réseau générique", () => {
    expect(isEmailNotConfirmedError("Network request failed")).toBe(false);
  });
});

describe("isEmailAlreadyRegisteredError", () => {
  it("détecte le message Supabase réel", () => {
    expect(isEmailAlreadyRegisteredError("User already registered")).toBe(true);
  });

  it("détecte la variante 'already exists'", () => {
    expect(isEmailAlreadyRegisteredError("A user with this email address already exists")).toBe(true);
  });

  it("ne confond pas un email non confirmé avec un compte déjà existant", () => {
    expect(isEmailAlreadyRegisteredError("Email not confirmed")).toBe(false);
  });

  it("ne matche pas une erreur de mot de passe invalide", () => {
    expect(isEmailAlreadyRegisteredError("Password should be at least 6 characters")).toBe(false);
  });
});
