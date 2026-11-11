/**
 * Suppression en deux temps pour les stores (séances, journal, dépenses) :
 * l'objet quitte la liste tout de suite, l'envoi au serveur n'a lieu qu'au
 * `commit` (cf. components/Toast.tsx). Tant qu'il attend, son id reste dans
 * `pending` : le store l'écarte des relectures du serveur, sinon il
 * réapparaîtrait pendant les secondes d'« Annuler ». Testé dans
 * undoableRemoval.test.ts.
 */
export function undoableRemoval<T extends { id: string }>(deps: {
  find: (id: string) => T | undefined;
  setList: (update: (list: T[]) => T[]) => void;
  commitRemote: (item: T) => void;
  pending: Set<string>;
}) {
  return (id: string): { commit: () => void; undo: () => void } | null => {
    const snapshot = deps.find(id);
    if (!snapshot) return null;
    deps.pending.add(id);
    deps.setList((list) => list.filter((i) => i.id !== id));
    return {
      commit: () => {
        deps.pending.delete(id);
        deps.commitRemote(snapshot);
      },
      undo: () => {
        deps.pending.delete(id);
        deps.setList((list) => (list.some((i) => i.id === id) ? list : [...list, snapshot]));
      },
    };
  };
}

/** Résultat d'une relecture du serveur, sans les objets dont la suppression attend son « Annuler ». */
export function withoutPending<T extends { id: string }>(list: T[], pending: Set<string>): T[] {
  return pending.size === 0 ? list : list.filter((i) => !pending.has(i.id));
}
