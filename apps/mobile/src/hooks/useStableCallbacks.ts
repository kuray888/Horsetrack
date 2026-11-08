import { useLayoutEffect, useRef, useState } from "react";

type Callbacks = Record<string, (...args: any[]) => any>;

/**
 * Objet de gestionnaires à identité STABLE (le même d'un rendu à l'autre),
 * qui appelle toujours la dernière version de chaque fonction.
 *
 * Pourquoi : un objet `{ onEdit: (s) => …, onDelete: … }` recréé à chaque
 * rendu rend inutile tout `React.memo` des enfants qui le reçoivent. Sur le
 * Planning, chaque frappe dans le formulaire de séance redessinait ainsi
 * toutes les cartes de la liste. Les clés doivent rester les mêmes d'un rendu
 * à l'autre (elles sont figées au premier).
 */
export function useStableCallbacks<T extends Callbacks>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const [stable] = useState(() => {
    const out: Callbacks = {};
    for (const key of Object.keys(handlers)) {
      out[key] = (...args: unknown[]) => latest.current[key](...args);
    }
    return out as T;
  });
  return stable;
}
