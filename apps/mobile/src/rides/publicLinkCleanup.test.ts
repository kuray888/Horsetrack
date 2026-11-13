import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, unknown> = {};
vi.mock("@/lib/localStore", () => ({
  readJson: async (k: string, d: unknown) => (k in store ? store[k] : d),
  writeJson: async (k: string, v: unknown) => {
    store[k] = v;
    return true;
  },
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "jwt" } } }) } },
}));

import { revokeLinksForSessions } from "./publicLink";

const KEY = "public_ride_links_v1";

describe("revokeLinksForSessions", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("supprime côté serveur le lien d'une séance supprimée, puis l'oublie", async () => {
    store[KEY] = { s1: { token: "T1", url: "u1" }, s2: { token: "T2", url: "u2" } };
    fetchMock.mockResolvedValue({ ok: true });
    await revokeLinksForSessions(["s1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("token=T1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(store[KEY]).toEqual({ s2: { token: "T2", url: "u2" } });
  });

  it("ne fait rien pour une séance sans lien", async () => {
    store[KEY] = { s2: { token: "T2", url: "u2" } };
    await revokeLinksForSessions(["s1"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hors ligne : garde le lien enregistré pour pouvoir le supprimer plus tard", async () => {
    store[KEY] = { s1: { token: "T1", url: "u1" } };
    fetchMock.mockRejectedValue(new Error("offline"));
    await revokeLinksForSessions(["s1"]);
    expect(store[KEY]).toEqual({ s1: { token: "T1", url: "u1" } });
  });
});
