import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { pickEngagementCard, type EngagementCardId } from "@/today/engagementSlotLogic";

type SlotContextValue = {
  winner: EngagementCardId | null;
  setWants: (id: EngagementCardId, wants: boolean) => void;
};

const SlotContext = createContext<SlotContextValue | null>(null);

/** Une seule carte d'engagement à la fois sur l'Accueil (cf. engagementSlotLogic.ts). */
export function EngagementSlotProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<ReadonlySet<EngagementCardId>>(new Set());
  const setWants = useCallback((id: EngagementCardId, wants: boolean) => {
    setCandidates((prev) => {
      if (prev.has(id) === wants) return prev;
      const next = new Set(prev);
      if (wants) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ winner: pickEngagementCard(candidates), setWants }), [candidates, setWants]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/**
 * `wants` : la carte a quelque chose à afficher. Renvoie si elle a la place.
 * Hors fournisseur (carte utilisée ailleurs), toujours vrai.
 */
export function useEngagementSlot(id: EngagementCardId, wants: boolean): boolean {
  const ctx = useContext(SlotContext);
  const setWants = ctx?.setWants;
  useEffect(() => {
    if (!setWants) return;
    setWants(id, wants);
    return () => setWants(id, false);
  }, [id, wants, setWants]);
  if (!ctx) return wants;
  return wants && ctx.winner === id;
}
