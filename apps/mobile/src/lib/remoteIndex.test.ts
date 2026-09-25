import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/localStore", () => ({
  readJson: async (_key: string, fallback: unknown) => fallback,
  writeJson: async () => true,
}));

const {
  __resetRemoteIndexForTests,
  beginWrite,
  endWrite,
  noteRemoteSnapshot,
  recordWriteSuccess,
  syncGuard,
  withWriteTracking,
} = await import("@/lib/remoteIndex");
const { mergeRemote } = await import("@/lib/mergeRemote");

beforeEach(() => {
  __resetRemoteIndexForTests();
  vi.useRealTimers();
});

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
    endWrite("t", "b");
    expect(syncGuard("t", 1000, none).isProtected("b")).toBe(false);
    await withWriteTracking("t", "c", async () => {
      expect(syncGuard("t", 1000, none).isProtected("c")).toBe(true);
    });
    expect(syncGuard("t", 1000, none).isProtected("c")).toBe(false);
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
