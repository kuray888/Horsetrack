import { describe, expect, it, vi } from "vitest";
import { isAccountMediaFileName } from "./localMedia";

// Hissé par vitest avant les imports : le module natif n'est jamais chargé.
vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));

describe("isAccountMediaFileName", () => {
  it("reconnaît les photos et documents copiés par imagePicker", () => {
    expect(isAccountMediaFileName("horse-1727712000000.jpg")).toBe(true);
    expect(isAccountMediaFileName("document-1727712000000.pdf")).toBe(true);
    expect(isAccountMediaFileName("document-1727712000000.png")).toBe(true);
  });

  it("ne touche jamais aux autres fichiers de l'app", () => {
    // Listes locales : effacées par les clearAll des stores, pas ici.
    expect(isAccountMediaFileName("store-horses_v1.json")).toBe(false);
    expect(isAccountMediaFileName("horse-notes.txt")).toBe(false);
    expect(isAccountMediaFileName("document-abc.pdf")).toBe(false);
    expect(isAccountMediaFileName("my-horse-1727712000000.jpg")).toBe(false);
  });
});
