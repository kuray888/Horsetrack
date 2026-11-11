import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUndoQueue } from "./undoQueue";

describe("file d'annulation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("valide la suppression une fois le délai passé, une seule fois", () => {
    const q = createUndoQueue(5000);
    const commit = vi.fn();
    q.add(commit);
    vi.advanceTimersByTime(4999);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    q.flush();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(q.size()).toBe(0);
  });

  it("« Annuler » empêche la suppression de partir", () => {
    const q = createUndoQueue(5000);
    const commit = vi.fn();
    const id = q.add(commit);
    expect(q.undo(id)).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(commit).not.toHaveBeenCalled();
    // Trop tard : déjà annulée ou déjà validée.
    expect(q.undo(id)).toBe(false);
  });

  it("annuler après la validation ne fait rien", () => {
    const q = createUndoQueue(5000);
    const commit = vi.fn();
    const id = q.add(commit);
    vi.advanceTimersByTime(5000);
    expect(q.undo(id)).toBe(false);
  });

  it("l'app passée en arrière-plan valide tout de suite ce qui attend", () => {
    const q = createUndoQueue(5000);
    const a = vi.fn();
    const b = vi.fn();
    q.add(a);
    q.add(b);
    q.flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("deux suppressions de suite gardent chacune leur annulation", () => {
    const q = createUndoQueue(5000);
    const a = vi.fn();
    const b = vi.fn();
    const idA = q.add(a);
    vi.advanceTimersByTime(3000);
    q.add(b);
    expect(q.undo(idA)).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("une validation qui échoue n'empêche pas les suivantes", () => {
    const q = createUndoQueue(5000);
    const ok = vi.fn();
    q.add(() => {
      throw new Error("réseau");
    });
    q.add(ok);
    expect(() => q.flush()).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
