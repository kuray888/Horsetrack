import { CoachChat } from "@/components/CoachChat";
import { CoachLocked } from "@/components/CoachLocked";
import { useSubscription } from "@/subscription/store";

export default function CoachScreen() {
  const { isGrandPrix } = useSubscription();
  if (!isGrandPrix) return <CoachLocked />;
  return <CoachChat />;
}
