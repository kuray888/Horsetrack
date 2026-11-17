import { describe, expect, it } from "vitest";
import { LANGUAGES, langFromLocale, languageSummary, localeFor, parseLangPreference, resolveLang } from "./langs";

describe("langFromLocale", () => {
  it("le français reste français, quelle que soit la région", () => {
    expect(langFromLocale("fr-FR")).toBe("fr");
    expect(langFromLocale("fr_BE")).toBe("fr");
    expect(langFromLocale("FR")).toBe("fr");
  });
  it("une langue non gérée donne l'anglais, comme avant", () => {
    expect(langFromLocale("ja-JP")).toBe("en");
    expect(langFromLocale("")).toBe("en");
  });
  it("un iPhone en anglais réglé sur la France (en-FR) lit l'anglais : c'est son choix, le sélecteur permet de changer", () => {
    expect(langFromLocale("en-FR")).toBe("en");
  });
});

describe("resolveLang", () => {
  it("Automatique suit le téléphone", () => {
    expect(resolveLang("auto", "fr-FR")).toBe("fr");
    expect(resolveLang("auto", "de-DE")).toBe("en");
  });
  it("un choix explicite l'emporte sur le téléphone", () => {
    expect(resolveLang("fr", "en-GB")).toBe("fr");
    expect(resolveLang("en", "fr-FR")).toBe("en");
  });
});

describe("parseLangPreference", () => {
  it("relit un choix valide, sinon Automatique (valeur absente, abîmée ou d'une langue retirée)", () => {
    expect(parseLangPreference("fr")).toBe("fr");
    expect(parseLangPreference("en")).toBe("en");
    expect(parseLangPreference("auto")).toBe("auto");
    expect(parseLangPreference(null)).toBe("auto");
    expect(parseLangPreference("klingon")).toBe("auto");
    expect(parseLangPreference(42)).toBe("auto");
  });
});

describe("langues proposées", () => {
  it("chaque langue a un nom écrit dans sa propre langue et un format de dates", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["fr", "en"]);
    expect(LANGUAGES.find((l) => l.code === "fr")?.name).toBe("Français");
    expect(LANGUAGES.find((l) => l.code === "en")?.name).toBe("English");
    expect(localeFor("fr")).toBe("fr-FR");
    expect(localeFor("en")).toBe("en-GB");
  });
});

describe("languageSummary", () => {
  const words = { auto: "Automatique", pending: "à la réouverture" };
  it("Automatique : dit quelle langue en résulte", () => {
    expect(languageSummary("auto", "fr", words)).toBe("Automatique · Français");
    expect(languageSummary("auto", "en", words)).toBe("Automatique · English");
  });
  it("choix explicite appliqué : juste le nom de la langue", () => {
    expect(languageSummary("en", "en", words)).toBe("English");
  });
  it("choix explicite pas encore appliqué (l'app n'a pas été rouverte) : on le dit", () => {
    expect(languageSummary("en", "fr", words)).toBe("English · à la réouverture");
  });
  it("Automatique qui donnera une autre langue à la réouverture : on le dit aussi", () => {
    expect(languageSummary("auto", "fr", words, "en")).toBe("Automatique · English · à la réouverture");
  });
});
