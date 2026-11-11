/**
 * Suppressions annulables (toast « Annuler ») : l'objet disparaît de l'écran
 * tout de suite, mais l'action définitive (suppression sur le serveur) ne part
 * qu'après le délai. « Annuler » la retient ; l'app qui passe en arrière-plan
 * valide tout ce qui attend (`flush`), pour qu'une app fermée juste après ne
 * laisse pas la suppression en suspens.
 *
 * Logique pure, sans React : testée dans undoQueue.test.ts.
 */
export type UndoQueue = {
  /** Programme `commit` après le délai ; renvoie l'identifiant à annuler. */
  add: (commit: () => void) => number;
  /** Retient la validation. Faux si elle est déjà partie ou déjà annulée. */
  undo: (id: number) => boolean;
  /** Valide tout de suite tout ce qui attend. */
  flush: () => void;
  size: () => number;
};

export function createUndoQueue(delayMs: number): UndoQueue {
  const pending = new Map<number, { commit: () => void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 1;

  function run(id: number) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    try {
      entry.commit();
    } catch {
      // Une validation qui échoue (réseau…) reste à la charge de la file de
      // synchronisation ; elle ne doit pas bloquer les autres.
    }
  }

  return {
    add(commit) {
      const id = nextId++;
      pending.set(id, { commit, timer: setTimeout(() => run(id), delayMs) });
      return id;
    },
    undo(id) {
      const entry = pending.get(id);
      if (!entry) return false;
      clearTimeout(entry.timer);
      pending.delete(id);
      return true;
    },
    flush() {
      for (const id of [...pending.keys()]) run(id);
    },
    size: () => pending.size,
  };
}
