import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRejectedWrite,
  clearRejectedWrites,
  noteRejectedWrite,
  rejectedWriteCount,
  subscribeToRejectedWrites,
} from "./rejectedWrites";

beforeEach(() => clearRejectedWrites());

describe("rejectedWrites", () => {
  it("compte chaque ligne refusée une seule fois", () => {
    noteRejectedWrite("training_sessions", "s1");
    noteRejectedWrite("training_sessions", "s1");
    noteRejectedWrite("documents", "s1");
    expect(rejectedWriteCount()).toBe(2);
  });

  it("oublie une ligne dès que le serveur l'accepte", () => {
    noteRejectedWrite("training_sessions", "s1");
    clearRejectedWrite("training_sessions", "s1");
    expect(rejectedWriteCount()).toBe(0);
  });

  it("prévient les abonnés (bannière) à chaque changement", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToRejectedWrites((n) => seen.push(n));
    noteRejectedWrite("goals", "g1");
    clearRejectedWrites();
    unsubscribe();
    noteRejectedWrite("goals", "g2");
    expect(seen).toEqual([0, 1, 0]);
  });
});
