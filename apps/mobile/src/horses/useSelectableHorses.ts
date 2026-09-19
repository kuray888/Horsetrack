import { useMemo } from "react";
import { useHorses, type Horse } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { selectableHorses } from "@/horses/selectableHorses";

/** Branchement React de `selectableHorses` (cf. ce module pour la règle et
 * ses justifications) — séparé de lui pour que la règle reste testable sans
 * importer react-native. À utiliser partout où l'on propose de choisir un ou
 * plusieurs chevaux : un seul endroit décide de ce qui est utilisable. */
export function useSelectableHorses(): Horse[] {
  const { horses } = useHorses();
  const subscription = useSubscription();
  const horseLimit = maxHorses(subscription);
  return useMemo(() => selectableHorses(horses, horseLimit), [horses, horseLimit]);
}
