import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * File d'attente des écritures cloud échouées (cf. lib/syncQueue.ts).
 *
 * Ce qui est vérifié ici décide si une séance créée sans réseau finit par
 * partir ou reste locale pour toujours — c'était le comportement d'avant.
 */

/** Stockage local simulé (cf. lib/localStore.ts, dont la vraie implémentation
 * est testée séparément). */
const store = new Map<string, unknown>();

vi.mock("@/lib/localStore", () => ({
  readJson: async (key: string, fallback: unknown) => store.get(key) ?? fallback,
  writeJson: async (key: string, value: unknown) => {
    store.set(key, value);
    return true;
  },
}));

const {
  clearSyncQueue,
  enqueueFailedWrite,
  flushSyncQueue,
  isPermanentError,
  keepForRetry,
  mergeOperation,
  pendingSyncCount,
  MAX_ATTEMPTS,
  MAX_QUEUE_LENGTH,
} = await import("@/lib/syncQueue");

const op = (table: string, id: string, attempts = 0) => ({ table, id, op: "upsert" as const, row: { id }, attempts });

beforeEach(async () => {
  store.clear();
  await clearSyncQueue();
});

describe("mergeOperation", () => {
  it("remplace l'opération qui visait déjà la même ligne", () => {
    const queue = [op("sessions", "s1"), op("sessions", "s2")];
    const merged = mergeOperation(queue, { ...op("sessions", "s1"), row: { id: "s1", notes: "à jour" } });
    expect(merged).toHaveLength(2);
    expect(merged.find((o) => o.id === "s1")?.row).toEqual({ id: "s1", notes: "à jour" });
  });

  it("laisse une suppression écraser un ajout non parti", () => {
    const queue = [op("sessions", "s1")];
    const merged = mergeOperation(queue, { table: "sessions", id: "s1", op: "delete", attempts: 0 });
    // Sinon rejouer l'upsert ressusciterait une entrée supprimée.
    expect(merged).toEqual([{ table: "sessions", id: "s1", op: "delete", attempts: 0 }]);
  });

  it("distingue deux tables partageant un identifiant", () => {
    const merged = mergeOperation([op("sessions", "x")], op("expenses", "x"));
    expect(merged).toHaveLength(2);
  });

  it("abandonne les plus anciennes au-delà du plafond", () => {
    const full = Array.from({ length: MAX_QUEUE_LENGTH }, (_, i) => op("sessions", `s${i}`));
    const merged = mergeOperation(full, op("sessions", "nouvelle"));
    expect(merged).toHaveLength(MAX_QUEUE_LENGTH);
    expect(merged[merged.length - 1].id).toBe("nouvelle");
    expect(merged.some((o) => o.id === "s0")).toBe(false);
  });
});

describe("isPermanentError", () => {
  it("reconnaît un refus qui ne passera jamais", () => {
    expect(isPermanentError({ code: "42501" })).toBe(true); // RLS
    expect(isPermanentError({ code: "23503" })).toBe(true); // cheval supprimé
  });

  it("traite tout le reste comme récupérable", () => {
    expect(isPermanentError({ code: "PGRST301" })).toBe(false);
    expect(isPermanentError(null)).toBe(false);
    expect(isPermanentError(undefined)).toBe(false);
  });
});

describe("keepForRetry", () => {
  it("incrémente les tentatives", () => {
    expect(keepForRetry(op("sessions", "s1"))?.attempts).toBe(1);
  });

  it("abandonne une fois les essais épuisés", () => {
    expect(keepForRetry(op("sessions", "s1", MAX_ATTEMPTS - 1))).toBeNull();
  });
});

describe("enqueueFailedWrite", () => {
  it("met l'écriture en attente", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } }, { code: "PGRST301" });
    expect(pendingSyncCount()).toBe(1);
  });

  it("ignore un refus définitif, qu'il ne sert à rien de retenter", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } }, { code: "42501" });
    expect(pendingSyncCount()).toBe(0);
  });
});

describe("flushSyncQueue", () => {
  it("vide la file quand tout passe", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    await enqueueFailedWrite({ table: "expenses", id: "e1", op: "delete" });
    const sent: string[] = [];
    await flushSyncQueue(async (o) => {
      sent.push(`${o.op}:${o.table}:${o.id}`);
      return { error: null };
    });
    expect(sent).toEqual(["upsert:sessions:s1", "delete:expenses:e1"]);
    expect(pendingSyncCount()).toBe(0);
  });

  it("garde ce qui a encore échoué, en comptant la tentative", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    await flushSyncQueue(async () => ({ error: { code: "PGRST301" } }));
    expect(pendingSyncCount()).toBe(1);
    // Quatre reprises de plus épuisent les essais (cf. MAX_ATTEMPTS).
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      await flushSyncQueue(async () => ({ error: { code: "PGRST301" } }));
    }
    expect(pendingSyncCount()).toBe(0);
  });

  it("abandonne immédiatement une opération définitivement refusée", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    await flushSyncQueue(async () => ({ error: { code: "42501" } }));
    expect(pendingSyncCount()).toBe(0);
  });

  it("garde l'opération quand l'envoi lève au lieu de renvoyer une erreur", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    await flushSyncQueue(async () => {
      throw new Error("réseau coupé");
    });
    expect(pendingSyncCount()).toBe(1);
  });

  it("ne perd pas ce qui arrive pendant le vidage", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    await flushSyncQueue(async () => {
      // L'utilisateur continue de saisir pendant que la file se vide.
      await enqueueFailedWrite({ table: "sessions", id: "s2", op: "upsert", row: { id: "s2" } });
      return { error: null };
    });
    expect(pendingSyncCount()).toBe(1);
  });

  it("refuse deux vidages concurrents, qui enverraient tout en double", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    let sends = 0;
    const send = async () => {
      sends++;
      await new Promise((r) => setTimeout(r, 5));
      return { error: null };
    };
    await Promise.all([flushSyncQueue(send), flushSyncQueue(send)]);
    expect(sends).toBe(1);
  });
});

describe("clearSyncQueue", () => {
  it("jette tout sans rien envoyer (changement de compte)", async () => {
    await enqueueFailedWrite({ table: "sessions", id: "s1", op: "upsert", row: { id: "s1" } });
    await clearSyncQueue();
    expect(pendingSyncCount()).toBe(0);
  });
});
