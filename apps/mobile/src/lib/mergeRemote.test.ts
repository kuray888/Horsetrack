import { describe, it, expect } from "vitest";
import { mergeRemote, pickFileUrl, signedUrlExpiresSoon } from "./mergeRemote";
import type { SyncGuard } from "./remoteIndex";

type Row = { id: string; title: string; local?: string };

function guard(opts: { protectedIds?: string[]; known?: string[]; deleted?: string[] } = {}): SyncGuard {
  return {
    isProtected: (id) => (opts.protectedIds ?? []).includes(id),
    isKnown: (id) => (opts.known ?? []).includes(id),
    isRecentlyDeleted: (id) => (opts.deleted ?? []).includes(id),
  };
}

describe("mergeRemote", () => {
  it("prend la version du serveur pour une ligne non protégée", () => {
    const r = mergeRemote<Row>([{ id: "a", title: "ancien" }], [{ id: "a", title: "nouveau" }], guard({ known: ["a"] }));
    expect(r.items).toEqual([{ id: "a", title: "nouveau" }]);
    expect(r.updated).toHaveLength(1);
  });

  it("garde la version locale d'une ligne protégée (en file, en vol, écrite pendant la relecture)", () => {
    const r = mergeRemote<Row>([{ id: "a", title: "saisie locale" }], [{ id: "a", title: "serveur" }], guard({ protectedIds: ["a"] }));
    expect(r.items).toEqual([{ id: "a", title: "saisie locale" }]);
    expect(r.changed).toBe(false);
  });

  it("ajoute ce qui a été créé ailleurs", () => {
    const r = mergeRemote<Row>([], [{ id: "b", title: "créé par la DP" }], guard());
    expect(r.items).toEqual([{ id: "b", title: "créé par la DP" }]);
    expect(r.added).toHaveLength(1);
  });

  it("ne ressuscite pas une ligne supprimée ici pendant la relecture", () => {
    const r = mergeRemote<Row>([], [{ id: "b", title: "x" }], guard({ deleted: ["b"] }));
    expect(r.items).toEqual([]);
  });

  it("ne ressuscite pas une ligne dont la suppression est en file", () => {
    const r = mergeRemote<Row>([], [{ id: "b", title: "x" }], guard({ protectedIds: ["b"] }));
    expect(r.items).toEqual([]);
  });

  it("retire une ligne connue du serveur qui y a disparu (supprimée ailleurs)", () => {
    const r = mergeRemote<Row>([{ id: "a", title: "x" }], [], guard({ known: ["a"] }));
    expect(r.items).toEqual([]);
    expect(r.removed).toHaveLength(1);
  });

  it("ne jette JAMAIS une ligne locale jamais envoyée", () => {
    const r = mergeRemote<Row>([{ id: "a", title: "hors ligne" }], [], guard());
    expect(r.items).toEqual([{ id: "a", title: "hors ligne" }]);
    expect(r.removed).toHaveLength(0);
  });

  it("garde les champs propres à l'appareil", () => {
    const r = mergeRemote<Row>(
      [{ id: "a", title: "x", local: "notif-123" }],
      [{ id: "a", title: "y" }],
      guard({ known: ["a"] }),
      (l, rem) => ({ ...rem, local: l.local })
    );
    expect(r.items).toEqual([{ id: "a", title: "y", local: "notif-123" }]);
  });

  it("renvoie la liste locale elle-même quand rien ne change", () => {
    const local = [{ id: "a", title: "x" }];
    const r = mergeRemote<Row>(local, [{ id: "a", title: "x" }], guard({ known: ["a"] }));
    expect(r.items).toBe(local);
    expect(r.changed).toBe(false);
  });

  it("compare les dates par valeur", () => {
    type D = { id: string; date: Date };
    const r = mergeRemote<D>([{ id: "a", date: new Date(2026, 0, 1) }], [{ id: "a", date: new Date(2026, 0, 1) }], guard());
    expect(r.changed).toBe(false);
  });
});

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const signed = (expSeconds: number) => `https://x.supabase.co/storage/v1/object/sign/b/p.jpg?token=${b64url({ alg: "HS256" })}.${b64url({ exp: expSeconds })}.sig`;

describe("URL signées", () => {
  const now = Date.UTC(2026, 8, 25);
  it("détecte une URL qui expire bientôt", () => {
    expect(signedUrlExpiresSoon(signed(now / 1000 + 3 * 86400), undefined, now)).toBe(true);
    expect(signedUrlExpiresSoon(signed(now / 1000 + 60 * 86400), undefined, now)).toBe(false);
    expect(signedUrlExpiresSoon("file:///doc.jpg", undefined, now)).toBe(false);
    expect(signedUrlExpiresSoon("https://x/sans-token", undefined, now)).toBe(true);
  });

  it("garde le fichier local tant que c'est le même fichier distant", () => {
    expect(pickFileUrl("file:///a.jpg", "u/a.jpg", "https://nouvelle", "u/a.jpg")).toBe("file:///a.jpg");
    expect(pickFileUrl("file:///a.jpg", "u/a.jpg", "https://nouvelle", "u/b.pdf")).toBe("https://nouvelle");
    expect(pickFileUrl(null, null, null, null)).toBeNull();
  });
});
