import { describe, expect, it } from "vitest";
import { unsentCountBeforeSignOut } from "./signOutGuard";

const doc = (over: Partial<{ fileUri: string | null; filePath: string | null }> = {}) => ({
  fileUri: "https://x/doc.jpg",
  filePath: "u/doc.jpg",
  ...over,
});
const entry = (over: Partial<{ horseId: string | null; photoUri: string | null; photoPath: string | null }> = {}) => ({
  horseId: "h1",
  photoUri: null,
  photoPath: null,
  videoUri: null,
  videoPath: null,
  ...over,
});

describe("unsentCountBeforeSignOut", () => {
  it("rien en attente : pas d'avertissement", () => {
    expect(unsentCountBeforeSignOut({ pendingWrites: 0, documents: [doc()], journal: [entry()] })).toBe(0);
  });

  it("compte les écritures en file d'attente", () => {
    expect(unsentCountBeforeSignOut({ pendingWrites: 3, documents: [], journal: [] })).toBe(3);
  });

  it("compte un document dont le fichier n'est jamais parti", () => {
    const local = doc({ fileUri: "file:///ordonnance.jpg", filePath: null });
    expect(unsentCountBeforeSignOut({ pendingWrites: 0, documents: [local, doc()], journal: [] })).toBe(1);
  });

  it("compte une photo de souvenir jamais envoyée", () => {
    const local = entry({ photoUri: "file:///souvenir.jpg" });
    expect(unsentCountBeforeSignOut({ pendingWrites: 1, documents: [], journal: [local] })).toBe(2);
  });
});
