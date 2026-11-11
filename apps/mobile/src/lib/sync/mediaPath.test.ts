import { describe, expect, it } from "vitest";
import { journalMediaPrefix, versionedMediaPath } from "./mediaPath";

describe("versionedMediaPath", () => {
  it("même fichier local → même chemin distant (un renvoi écrase, rien ne s'accumule)", () => {
    const uri = "file:///var/mobile/Documents/horse-1731320000000.jpg";
    expect(versionedMediaPath("hs", "photo", uri, "jpg")).toBe(versionedMediaPath("hs", "photo", uri, "jpg"));
  });

  it("nouvelle photo choisie → nouveau chemin : l'autre appareil voit le changement", () => {
    const before = versionedMediaPath("hs", "photo", "file:///D/horse-1731320000000.jpg", "jpg");
    const after = versionedMediaPath("hs", "photo", "file:///D/horse-1731329999999.jpg", "jpg");
    expect(after).not.toBe(before);
  });

  it("reste dans le dossier du cheval, hors du sous-dossier journal pour la photo de profil", () => {
    const path = versionedMediaPath("hs", "photo", "file:///D/horse-1731320000000.jpg", "jpg");
    expect(path.split("/")).toHaveLength(2);
    expect(path.startsWith("hs/photo-")).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("souvenir : sous journal/, préfixé par l'identifiant de l'entrée", () => {
    const path = versionedMediaPath("hs/journal", "e1", "file:///D/journal-photo-1731320000000.jpg", "jpg");
    expect(path.startsWith(`hs/journal/${journalMediaPrefix("e1")}`)).toBe(true);
  });

  it("ne garde que des caractères sûrs du nom local", () => {
    const path = versionedMediaPath("hs", "photo", "file:///D/../weird name?.jpg", "jpg");
    expect(path).toMatch(/^hs\/photo-[A-Za-z0-9_-]+\.jpg$/);
  });

  it("sans nom de fichier exploitable : chemin historique", () => {
    expect(versionedMediaPath("hs", "photo", "file:///", "jpg")).toBe("hs/photo.jpg");
  });
});
