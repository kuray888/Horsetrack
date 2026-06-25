import { router } from "expo-router";
import { CoachChat } from "@/components/CoachChat";
import { CoachLocked } from "@/components/CoachLocked";
import { useSubscription } from "@/subscription/store";

/** Coach IA ouvert depuis la bulle flottante, accessible depuis n'importe quel onglet. */
export default function CoachModal() {
  const { isGrandPrix } = useSubscription();
  if (!isGrandPrix) return <CoachLocked onClose={() => router.back()} />;
  return <CoachChat onClose={() => router.back()} />;
}
