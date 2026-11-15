import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding, type Discipline } from "@/onboarding/store";
import { DISCIPLINES, TOTAL_STEPS } from "@/onboarding/options";
import { useAdvanceGuard } from "@/onboarding/useAdvanceGuard";
import { hapticSelection } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { t } from "@/i18n";

/** Délai entre le choix et l'écran suivant : le temps de voir la carte
 * cochée, sans second toucher sur « Continuer ». */
const ADVANCE_DELAY_MS = 250;

/** Discipline principale, en un toucher. Elle personnalise le coach, les
 * conseils du jour et la séance proposée juste après (cf. firstAction.ts). */
export default function DisciplineStep() {
  const { rider, setRider } = useOnboarding();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guard = useAdvanceGuard();
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function next() {
    // Une seule ouverture, quel que soit le déclencheur (minuterie ou bouton).
    if (!guard.tryAdvance()) return;
    if (timer.current) clearTimeout(timer.current);
    router.push("/(onboarding)/horse-basics");
  }

  function choose(mainDiscipline: Discipline) {
    hapticSelection();
    setRider({ mainDiscipline });
    if (guard.advanced) return; // second toucher pendant la transition
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, prefersReducedMotion() ? 0 : ADVANCE_DELAY_MS);
  }

  return (
    <OnboardingShell
      stepId="discipline"
      step={1}
      total={TOTAL_STEPS}
      title={t("Ta discipline principale ?")}
      subtitle={t("Celle que tu pratiques le plus souvent.")}
      ctaDisabled={!rider.mainDiscipline}
      onNext={next}
    >
      <SingleSelect options={DISCIPLINES} value={rider.mainDiscipline} onChange={choose} />
    </OnboardingShell>
  );
}
