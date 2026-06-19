import { router } from "expo-router";
import { CoachChat } from "@/components/CoachChat";

/** Coach IA ouvert depuis la bulle flottante, accessible depuis n'importe quel onglet. */
export default function CoachModal() {
  return <CoachChat onClose={() => router.back()} />;
}
