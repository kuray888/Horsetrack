import { TextInput } from "react-native";
import { router } from "expo-router";
import { OnboardingShell } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { useOnboarding } from "@/onboarding/store";
import { TOTAL_STEPS } from "@/onboarding/options";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Dernière question de l'onboarding : contexte libre du cavalier, destiné à
 * nourrir la personnalisation du programme par le Coach IA (objectifs précis,
 * contraintes, tout ce qui ne rentre pas dans les questions précédentes).
 * Toujours optionnelle — on ne bloque jamais la fin de l'onboarding dessus.
 */
export default function ExtraInfo() {
  const { rider, setRider } = useOnboarding();

  return (
    <OnboardingShell
      step={10}
      total={TOTAL_STEPS}
      title="Encore une chose…"
      subtitle="Objectifs précis, contraintes, ce qui compte pour toi : dis-nous tout ce qui peut aider à personnaliser ton programme."
      ctaLabel={rider.additionalInfo.trim() ? "Continuer" : "Passer"}
      onNext={() => router.push("/(onboarding)/building")}
    >
      <Field label="Tout ce que tu veux ajouter (optionnel)">
        <TextInput
          className={INPUT}
          placeholder="Ex : je veux progresser en CSO avant l'été, mon cheval a peur des bâches, je n'ai que le week-end pour monter…"
          value={rider.additionalInfo}
          onChangeText={(additionalInfo) => setRider({ additionalInfo })}
          multiline
          numberOfLines={6}
          style={{ minHeight: 140, textAlignVertical: "top" }}
        />
      </Field>
    </OnboardingShell>
  );
}
