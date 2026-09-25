import { beforeEach, describe, expect, it, vi } from "vitest";
// Import de TYPE seulement : effacé à la compilation, il ne déclenche donc pas
// le chargement du module avant que `vi.mock` plus bas n'ait posé son double.
import type { SyncOperation } from "@/lib/syncQueue";

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
  discardSupersededWrites,
  withoutSuperseded,
  isNetworkError,
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

/**
 * Course entre la saisie de l'utilisateur et le vidage de la file.
 *
 * Cas réel : mode avion, l'utilisateur continue de saisir, l'app revient au
 * premier plan (ce qui déclenche un vidage), et une écriture échoue pendant
 * que le vidage est en cours. C'est exactement la situation que ce module
 * existe pour couvrir — elle perdait des données jusqu'à l'audit du
 * 2026-09-23.
 */
describe("saisie pendant le vidage", () => {
  it("garde la modification la plus récente, pas le contenu périmé déjà en file", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "s1", row: { id: "s1", notes: "ancien" } });

    await flushSyncQueue(async () => {
      // L'utilisateur modifie la même séance pendant l'envoi ; ça échoue aussi.
      await enqueueFailedWrite({
        table: "training_sessions",
        op: "upsert",
        id: "s1",
        row: { id: "s1", notes: "nouveau" },
      });
      return { error: { code: "503" } };
    });

    const queue = store.get("sync_queue_v1") as SyncOperation[];
    expect(queue).toHaveLength(1);
    expect(queue[0].row).toEqual({ id: "s1", notes: "nouveau" });
    // Repart de zéro : c'est une saisie neuve, pas une énième reprise.
    expect(queue[0].attempts).toBe(0);
  });

  it("ne laisse pas un upsert réussi annuler la suppression saisie entre-temps", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "s2", row: { id: "s2" } });

    await flushSyncQueue(async () => {
      // L'utilisateur supprime la séance pendant l'envoi.
      await enqueueFailedWrite({ table: "training_sessions", op: "delete", id: "s2" });
      return { error: null }; // l'upsert, lui, part avec succès
    });

    // Sans ça, la séance supprimée ressuscite dans le cloud au prochain pull.
    const queue = store.get("sync_queue_v1") as SyncOperation[];
    expect(queue).toHaveLength(1);
    expect(queue[0].op).toBe("delete");
  });

  it("n'écrase pas une autre ligne saisie pendant l'envoi", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "s3", row: { id: "s3" } });

    await flushSyncQueue(async () => {
      await enqueueFailedWrite({ table: "appointments", op: "upsert", id: "a1", row: { id: "a1" } });
      return { error: { code: "503" } };
    });

    const queue = store.get("sync_queue_v1") as SyncOperation[];
    expect(queue.map((o) => o.id).sort()).toEqual(["a1", "s3"]);
  });

  it("abandonne l'envoi et ne réinstalle rien si le compte change en cours de route", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "s4", row: { id: "s4" } });
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "s5", row: { id: "s5" } });

    let envois = 0;
    await flushSyncQueue(async () => {
      envois++;
      // Déconnexion/changement de compte pendant l'envoi (cf. login.tsx).
      await clearSyncQueue();
      return { error: { code: "503" } };
    });

    // On s'arrête au premier envoi au lieu de continuer sous la nouvelle
    // identité, et la file reste vide : ces écritures sont celles du compte
    // précédent.
    expect(envois).toBe(1);
    expect(pendingSyncCount()).toBe(0);
    expect(store.get("sync_queue_v1")).toEqual([]);
  });
});

describe("écriture réussie après un échec sur la même ligne", () => {
  it("retire l'ancienne version en file, garde les autres lignes", () => {
    const list = [
      { ...op("training_sessions", "s1"), enqueuedAt: 1000 },
      { ...op("training_sessions", "s2"), enqueuedAt: 1000 },
      { ...op("appointments", "s1"), enqueuedAt: 1000 },
    ];
    const next = withoutSuperseded(list, { table: "training_sessions", id: "s1" }, 2000);
    expect(next.map((o) => `${o.table}/${o.id}`)).toEqual(["training_sessions/s2", "appointments/s1"]);
  });

  it("garde une version mise en file APRÈS le départ de l'écriture réussie", () => {
    const list = [{ ...op("training_sessions", "s1"), enqueuedAt: 3000 }];
    expect(withoutSuperseded(list, { table: "training_sessions", id: "s1" }, 2000)).toHaveLength(1);
  });

  it("traite une opération sans date (ancien format) comme périmée", () => {
    const list = [op("training_sessions", "s1")];
    expect(withoutSuperseded(list, { table: "training_sessions", id: "s1" }, 2000)).toHaveLength(0);
  });

  it("n'envoie pas une opération retirée pendant le vidage", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "a", row: { id: "a" } });
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "b", row: { id: "b" } });
    const sent: string[] = [];
    await flushSyncQueue(async (o: SyncOperation) => {
      sent.push(o.id);
      // Pendant l'envoi de « a », une écriture directe réussit sur « b ».
      if (o.id === "a") await discardSupersededWrites({ table: "training_sessions", id: "b" }, Date.now() + 1000);
      return { error: null };
    });
    expect(sent).toEqual(["a"]);
    expect(pendingSyncCount()).toBe(0);
  });
});

describe("coupure réseau", () => {
  it("distingue une coupure réseau d'un refus du serveur", () => {
    expect(isNetworkError({ message: "TypeError: Network request failed" })).toBe(true);
    expect(isNetworkError({ message: "" })).toBe(true);
    expect(isNetworkError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isNetworkError({ code: "PGRST116", message: "network" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  it("ne consomme pas d'essai hors réseau : jamais abandonnée", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "x", row: { id: "x" } });
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
      await flushSyncQueue(async () => ({ error: { message: "Network request failed" } }));
    }
    expect(pendingSyncCount()).toBe(1);
  });

  it("abandonne toujours après plusieurs refus du serveur", async () => {
    await enqueueFailedWrite({ table: "training_sessions", op: "upsert", id: "y", row: { id: "y" } });
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) {
      await flushSyncQueue(async () => ({ error: { code: "57014", message: "canceling statement due to timeout" } }));
    }
    expect(pendingSyncCount()).toBe(0);
  });
});
