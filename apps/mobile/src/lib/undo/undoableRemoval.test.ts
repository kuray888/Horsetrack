import { describe, expect, it, vi } from "vitest";
import { undoableRemoval } from "./undoableRemoval";

type Item = { id: string; label: string };

function setup(initial: Item[]) {
  let list = [...initial];
  const pending = new Set<string>();
  const commitRemote = vi.fn();
  const remove = undoableRemoval<Item>({
    find: (id) => list.find((i) => i.id === id),
    setList: (fn) => {
      list = fn(list);
    },
    commitRemote,
    pending,
  });
  return { remove, pending, commitRemote, list: () => list };
}

describe("suppression annulable", () => {
  it("retire tout de suite, sans toucher au serveur avant la validation", () => {
    const s = setup([{ id: "a", label: "A" }, { id: "b", label: "B" }]);
    const r = s.remove("a");
    expect(s.list().map((i) => i.id)).toEqual(["b"]);
    expect(s.pending.has("a")).toBe(true);
    expect(s.commitRemote).not.toHaveBeenCalled();
    r?.commit();
    expect(s.commitRemote).toHaveBeenCalledWith({ id: "a", label: "A" });
    expect(s.pending.has("a")).toBe(false);
  });

  it("« Annuler » remet l'objet tel quel, une seule fois", () => {
    const s = setup([{ id: "a", label: "A" }]);
    const r = s.remove("a");
    r?.undo();
    r?.undo();
    expect(s.list()).toEqual([{ id: "a", label: "A" }]);
    expect(s.pending.size).toBe(0);
    expect(s.commitRemote).not.toHaveBeenCalled();
  });

  it("objet inconnu : rien", () => {
    expect(setup([]).remove("x")).toBeNull();
  });
});
