import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Migration SecureStore → fichier JSON (cf. lib/localStore.ts).
 *
 * Testé avec des doublures des modules natifs : ce qui compte ici n'est pas
 * qu'expo écrive vraiment sur le disque, mais l'ORDRE de lecture et ce qui
 * est recopié — c'est-à-dire ce qui décide si un utilisateur retrouve ses
 * données ou un compte vide après la mise à jour.
 */

/** Contenu du « disque », par nom de fichier. */
const files = new Map<string, string>();
/** Contenu du « keychain », par clé. */
const keychain = new Map<string, string>();
/** Noms de fichiers dont l'écriture doit échouer (disque plein…). */
const failingWrites = new Set<string>();

vi.mock("expo-file-system", () => ({
  Paths: { document: "doc" },
  File: class {
    name: string;
    constructor(..._uris: unknown[]) {
      this.name = String(_uris[_uris.length - 1]);
    }
    get exists() {
      return files.has(this.name);
    }
    async text() {
      const value = files.get(this.name);
      if (value === undefined) throw new Error("ENOENT");
      return value;
    }
    write(content: string) {
      if (failingWrites.has(this.name)) throw new Error("ENOSPC");
      files.set(this.name, content);
    }
    delete() {
      files.delete(this.name);
    }
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => keychain.get(key) ?? null,
  deleteItemAsync: async (key: string) => void keychain.delete(key),
}));

const alerts: string[] = [];
vi.mock("react-native", () => ({
  Alert: { alert: (title: string) => void alerts.push(title) },
}));

const { readJson, writeJson, removeJson, resetWriteFailureNotice } = await import("@/lib/localStore");

const FILE = "store-journal_v1.json";

beforeEach(() => {
  files.clear();
  keychain.clear();
  failingWrites.clear();
  alerts.length = 0;
  resetWriteFailureNotice();
});

describe("readJson", () => {
  it("lit le fichier quand il existe", async () => {
    files.set(FILE, JSON.stringify([{ id: "a" }]));
    expect(await readJson("journal_v1", [])).toEqual([{ id: "a" }]);
  });

  it("migre l'ancienne valeur SecureStore à la première lecture", async () => {
    keychain.set("journal_v1", JSON.stringify([{ id: "ancien" }]));
    expect(await readJson("journal_v1", [])).toEqual([{ id: "ancien" }]);
    // Recopiée dans le fichier, qui devient la source de vérité…
    expect(files.get(FILE)).toBe(JSON.stringify([{ id: "ancien" }]));
    // …sans effacer l'original : une build antérieure réinstallée doit
    // retrouver ses données plutôt qu'un compte vide.
    expect(keychain.get("journal_v1")).toBeDefined();
  });

  it("préfère le fichier à l'ancienne valeur, une fois migré", async () => {
    files.set(FILE, JSON.stringify([{ id: "recent" }]));
    keychain.set("journal_v1", JSON.stringify([{ id: "perime" }]));
    expect(await readJson("journal_v1", [])).toEqual([{ id: "recent" }]);
  });

  it("rend la valeur même si la recopie échoue, pour la retenter plus tard", async () => {
    keychain.set("journal_v1", JSON.stringify([{ id: "ancien" }]));
    failingWrites.add(FILE);
    expect(await readJson("journal_v1", [])).toEqual([{ id: "ancien" }]);
    expect(files.has(FILE)).toBe(false);
    // Rien n'est perdu : pas de raison d'alarmer l'utilisateur ici.
    expect(alerts).toEqual([]);
  });

  it("retombe sur la valeur par défaut quand il n'y a rien, ou du JSON cassé", async () => {
    expect(await readJson("journal_v1", ["defaut"])).toEqual(["defaut"]);
    files.set(FILE, "{ pas du json");
    expect(await readJson("journal_v1", ["defaut"])).toEqual(["defaut"]);
  });

  it("préfère l'ancienne copie à un fichier tronqué plutôt qu'un compte vide", async () => {
    // Écriture interrompue : le fichier existe mais ne se relit pas. La copie
    // SecureStore est périmée, mais elle est vraie.
    files.set(FILE, '[{"id": "tron');
    keychain.set("journal_v1", JSON.stringify([{ id: "ancien" }]));
    expect(await readJson("journal_v1", [])).toEqual([{ id: "ancien" }]);
  });
});

describe("writeJson", () => {
  it("écrit et confirme le succès", async () => {
    expect(await writeJson("journal_v1", [{ id: "a" }])).toBe(true);
    expect(files.get(FILE)).toBe(JSON.stringify([{ id: "a" }]));
  });

  it("signale l'échec au code appelant ET à l'utilisateur", async () => {
    failingWrites.add(FILE);
    expect(await writeJson("journal_v1", [])).toBe(false);
    expect(alerts).toEqual(["Sauvegarde locale impossible"]);
  });

  it("n'alerte qu'une fois par session", async () => {
    failingWrites.add(FILE);
    await writeJson("journal_v1", []);
    await writeJson("journal_v1", []);
    await writeJson("journal_v1", []);
    // Sinon une alerte par frappe rendrait l'app inutilisable.
    expect(alerts).toHaveLength(1);
  });
});

describe("removeJson", () => {
  it("efface les deux stockages, pour ne pas ressusciter le compte précédent", async () => {
    files.set(FILE, "[]");
    keychain.set("journal_v1", "[]");
    await removeJson("journal_v1");
    expect(files.has(FILE)).toBe(false);
    expect(keychain.has("journal_v1")).toBe(false);
  });
});
