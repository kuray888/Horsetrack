import { beforeEach, describe, expect, it, vi } from "vitest";

// Fichier simulé : permet de vérifier ce qui survit à un redémarrage de l'app.
const disk = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("@/lib/localStore", () => ({
  readJson: async (_key: string, fallback: unknown) => disk.value ?? fallback,
  writeJson: async (_key: string, value: unknown) => {
    disk.value = JSON.parse(JSON.stringify(value));
    return true;
  },
}));

const {
  __resetRemoteIndexForTests,
  beginWrite,
  endWrite,
  loadRemoteIndex,
  noteRemoteSnapshot,
  recordWriteSuccess,
  syncGuard,
  unconfirmedDeletes,
  withWriteTracking,
} = await import("@/lib/remoteIndex");
const { mergeRemote, unsyncedLocalIds } = await import("@/lib/mergeRemote");

beforeEach(() => {
  __resetRemoteIndexForTests();
  disk.value = undefined;
  vi.useRealTimers();
});

/** Simule une fermeture puis une réouverture de l'app : la mémoire repart de
 * zéro, seul le fichier reste. */
async function restartApp() {
  const saved = disk.value;
  __resetRemoteIndexForTests();
  disk.value = saved;
  // __resetRemoteIndexForTests marque le module « chargé » : on force une vraie relecture.
  (await import("@/lib/remoteIndex")).__markUnloadedForTests();
  await loadRemoteIndex();
}

const none = new Set<string>();

describe("remoteIndex", () => {
  it("une ligne vue à une relecture devient connue pour les relectures suivantes", () => {
    noteRemoteSnapshot("t", ["a"], 1000);
    expect(syncGuard("t", 2000, none).isKnown("a")).toBe(true);
    // …mais pas pour une relecture partie avant qu'on l'ait vue.
    expect(syncGuard("t", 500, none).isKnown("a")).toBe(false);
  });

  it("protège une ligne en file ou en cours d'envoi", async () => {
    expect(syncGuard("t", 1000, new Set(["a"])).isProtected("a")).toBe(true);
    beginWrite("t", "b");
    expect(syncGuard("t", 1000, none).isProtected("b")).toBe(true);
    // Fin d'envoi SANS confirmation du serveur : toujours protégée, et à renvoyer.
    endWrite("t", "b");
    expect(syncGuard("t", 1000, none).isProtected("b")).toBe(true);
    expect(syncGuard("t", 1000, none).needsResend?.("b")).toBe(true);
    await withWriteTracking("t", "c", async () => {
      expect(syncGuard("t", 1000, none).isProtected("c")).toBe(true);
      // En vol : pas à renvoyer, l'envoi est en cours.
      expect(syncGuard("t", 1000, none).needsResend?.("c")).toBe(false);
      recordWriteSuccess("t", "c", false);
    });
    // Confirmée par le serveur : plus de marque (relecture partie après).
    expect(syncGuard("t", Date.now() + 1000, none).isProtected("c")).toBe(false);
    expect(syncGuard("t", Date.now() + 1000, none).needsResend?.("c")).toBe(false);
  });

  it("une confirmation n'efface pas la marque d'une modification plus récente encore en vol", () => {
    beginWrite("t", "a"); // première modification
    beginWrite("t", "a"); // seconde, partie avant la réponse à la première
    recordWriteSuccess("t", "a", false); // la première est confirmée…
    endWrite("t", "a");
    // …mais la seconde ne l'est pas : la marque reste.
    expect(syncGuard("t", Date.now() + 1000, none).isProtected("a")).toBe(true);
    endWrite("t", "a"); // app fermée avant la réponse à la seconde
    expect(syncGuard("t", Date.now() + 1000, none).needsResend?.("a")).toBe(true);
  });

  it("une écriture suivie sous la clé d'une autre ligne ne laisse pas de marque", async () => {
    await withWriteTracking("appointments", "rdv", async () => {}, null);
    expect(syncGuard("appointments", 0, none).isProtected("rdv")).toBe(false);
  });

  it("protège une ligne écrite avec succès PENDANT la relecture", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    recordWriteSuccess("t", "a", false);
    const guard = syncGuard("t", 4000, none);
    expect(guard.isProtected("a")).toBe(true);
    expect(guard.isKnown("a")).toBe(false);
  });

  it("ne ressuscite pas une ligne supprimée pendant la relecture", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    recordWriteSuccess("t", "a", true);
    expect(syncGuard("t", 4000, none).isRecentlyDeleted("a")).toBe(true);
    expect(syncGuard("t", 6000, none).isRecentlyDeleted("a")).toBe(false);
  });

  it("une relecture n'oublie pas une ligne apprise après son départ", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    recordWriteSuccess("t", "neuve", false);
    // Relecture partie à 4000, absente du résultat : ne prouve rien.
    noteRemoteSnapshot("t", [], 4000);
    expect(syncGuard("t", 6000, none).isKnown("neuve")).toBe(true);
  });
});

describe("scénarios bout en bout", () => {
  type Row = { id: string; title: string };

  it("créé hors ligne puis relecture : jamais perdu", () => {
    const local: Row[] = [{ id: "offline", title: "vétérinaire" }];
    const r = mergeRemote(local, [], syncGuard("appointments", Date.now(), new Set(["offline"])));
    expect(r.items).toEqual(local);
  });

  it("supprimé par la demi-pension : disparaît au rafraîchissement suivant", () => {
    noteRemoteSnapshot("appointments", ["a"], 1000);
    const r = mergeRemote<Row>([{ id: "a", title: "maréchal" }], [], syncGuard("appointments", 2000, none));
    expect(r.items).toEqual([]);
  });

  it("ajouté par le propriétaire : apparaît chez la demi-pension", () => {
    const r = mergeRemote<Row>([], [{ id: "n", title: "ostéo" }], syncGuard("appointments", 2000, none));
    expect(r.items).toEqual([{ id: "n", title: "ostéo" }]);
  });

  it("créé ici et envoyé pendant la relecture : pas retiré", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    recordWriteSuccess("appointments", "x", false);
    const r = mergeRemote<Row>([{ id: "x", title: "dentiste" }], [], syncGuard("appointments", 4000, none));
    expect(r.items).toHaveLength(1);
  });
});

describe("app fermée pendant un envoi", () => {
  type Session = { id: string; date: string };

  it("une séance déplacée au lendemain ne revient pas à aujourd'hui", async () => {
    // Séance connue du serveur, à la date d'aujourd'hui.
    noteRemoteSnapshot("training_sessions", ["s1"], 1000);
    // Modification locale : départ de l'envoi… puis l'app est fermée avant la réponse.
    beginWrite("training_sessions", "s1");
    await restartApp();

    // Relecture au relancement : le serveur a encore l'ancienne date.
    const guard = syncGuard("training_sessions", Date.now(), none);
    const local: Session[] = [{ id: "s1", date: "demain" }];
    const server: Session[] = [{ id: "s1", date: "aujourd'hui" }];
    expect(mergeRemote(local, server, guard).items).toEqual(local);
    // …et la modification est renvoyée.
    expect(unsyncedLocalIds(local, server, guard)).toEqual(["s1"]);
  });

  it("une suppression interrompue est renvoyée au relancement", async () => {
    noteRemoteSnapshot("training_sessions", ["s2"], 1000);
    beginWrite("training_sessions", "s2", "delete");
    await restartApp();
    expect(unconfirmedDeletes()).toEqual([{ table: "training_sessions", id: "s2" }]);
    // Pas réintroduite par la relecture en attendant.
    const guard = syncGuard("training_sessions", Date.now(), none);
    expect(mergeRemote<Session>([], [{ id: "s2", date: "x" }], guard).items).toEqual([]);
  });

  it("une séance n'est renvoyée que si son cheval existe sur le serveur", () => {
    const guard = syncGuard("training_sessions", Date.now(), none);
    const local = [
      { id: "a", horseId: "cheval-en-ligne" },
      { id: "b", horseId: "cheval-pas-encore-envoye" },
    ];
    expect(unsyncedLocalIds(local, [], guard, (r) => r.horseId === "cheval-en-ligne")).toEqual(["a"]);
  });
});
