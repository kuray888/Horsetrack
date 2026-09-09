import { describe, expect, it } from "vitest";
import { withKeyLock } from "@/lib/keyLock";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Régression : la course Apple Sign In (cf. audit du 2026-09-09) venait de
 * deux appels SecureStore/RevenueCat sur la même clé lancés sans coordination
 * par (auth)/login.tsx et l'écouteur SIGNED_IN de subscription/store.tsx.
 * withKeyLock doit garantir qu'ils ne s'exécutent jamais en même temps, sans
 * pour autant bloquer des clés différentes entre elles (sinon ça ralentirait
 * inutilement des écrans sans rapport) ni rester bloqué après une erreur.
 */
describe("withKeyLock", () => {
  it("sérialise deux appels sur la même clé — le second n'attend que la fin du premier", async () => {
    const order: string[] = [];
    const first = deferred<void>();

    const call1 = withKeyLock("k", async () => {
      order.push("start-1");
      await first.promise;
      order.push("end-1");
    });
    const call2 = withKeyLock("k", async () => {
      order.push("start-2");
    });

    // Laisse le microtask queue tourner sans résoudre `first` : si withKeyLock
    // ne sérialisait pas, "start-2" apparaîtrait ici avant "end-1".
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["start-1"]);

    first.resolve();
    await Promise.all([call1, call2]);
    expect(order).toEqual(["start-1", "end-1", "start-2"]);
  });

  it("n'empêche pas deux clés différentes de s'exécuter en parallèle", async () => {
    const order: string[] = [];
    const blockerA = deferred<void>();

    const callA = withKeyLock("a", async () => {
      order.push("start-a");
      await blockerA.promise;
      order.push("end-a");
    });
    const callB = withKeyLock("b", async () => {
      order.push("start-b");
      order.push("end-b");
    });

    // "start-a" est déjà dans `order` à ce stade (callA est invoqué en
    // premier ci-dessus, son microtask démarre avant même la construction de
    // callB) — ce qu'on vérifie, c'est que B se termine sans attendre
    // blockerA, donc sans "end-a" dans `order`.
    await callB;
    expect(order).toContain("start-b");
    expect(order).toContain("end-b");
    expect(order).not.toContain("end-a");

    blockerA.resolve();
    await callA;
    expect(order).toContain("end-a");
  });

  it("une erreur sur le premier appel ne bloque pas les suivants sur la même clé", async () => {
    await expect(
      withKeyLock("k2", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const result = await withKeyLock("k2", async () => "ok");
    expect(result).toBe("ok");
  });

  it("propage la valeur de résolution à l'appelant", async () => {
    const result = await withKeyLock("k3", async () => 42);
    expect(result).toBe(42);
  });
});
