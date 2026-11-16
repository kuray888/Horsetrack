import { useMemo } from "react";
import { useSubscription } from "@/subscription/store";
import { useAccountCreatedAt } from "@/lib/currentUser";
import { canAddGoal, historyCutoff, isFreeTierRestricted } from "@/subscription/freeTier";

/**
 * Palier gratuit resserré appliqué au compte connecté (cf. freeTier.ts).
 * Pendant le chargement de l'abonnement, rien n'est restreint : un abonné ne
 * doit jamais voir un verrou apparaître puis disparaître.
 */
export function useFreeTier() {
  const { isActiveOrTrialing, loading } = useSubscription();
  const createdAt = useAccountCreatedAt();
  const restricted = !loading && isFreeTierRestricted(isActiveOrTrialing, createdAt);
  return useMemo(
    () => ({
      restricted,
      historyCutoff: historyCutoff(restricted),
      canAddGoal: (goalCount: number) => canAddGoal(restricted, goalCount),
    }),
    [restricted]
  );
}
