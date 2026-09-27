import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES } from "@/onboarding/options";
import { track } from "@/lib/analytics";
import { joinNames } from "@/subscription/paywallLogic";

/** Minuscule initiale seulement : « Saut d'obstacles (CSO) » devenait
 * « saut d'obstacles (cso) » avec un toLowerCase() sur tout le libellé. */
function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function PlanRow({ text, premium = false }: { text: string; premium?: boolean }) {
  return (
    <View className="flex-row items-start gap-3 py-2.5">
      <Text className={`text-base ${premium ? "text-primary" : "text-success"}`}>{premium ? "★" : "✓"}</Text>
      <Text className="flex-1 text-base text-text">{text}</Text>
    </View>
  );
}

export default function Summary() {
  const { rider, horses } = useOnboarding();
  const primary = horses.find((h) => h.isPrimary) ?? horses[0];
  const horseName = primary?.name?.trim() || "ton cheval";
  const disciplineLabel = DISCIPLINES.find((d) => d.value === (primary?.discipline ?? rider.mainDiscipline))?.label;
  const focus = primary?.weaknesses?.[0];
  const namedHorses = horses.filter((h) => h.name.trim().length > 0).map((h) => h.name.trim());

  useEffect(() => {
    track("onboarding_step_viewed", { step: "summary", horse_count: namedHorses.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="px-5 pt-8 pb-4 gap-5" showsVerticalScrollIndicator={false}>
        <FadeInView>
          <View className="gap-2">
            <Text className="text-3xl font-display leading-tight tracking-tight text-text">
              L&apos;écurie de {horseName} est prête 🎉
            </Text>
            <Text className="text-base text-muted">
              {/* L'objectif n'est plus demandé à l'inscription (cf.
                  onboarding/options.ts TOTAL_STEPS). */}
              {disciplineLabel
                ? `Tout est prêt pour progresser ensemble en ${lowerFirst(disciplineLabel)}.`
                : "Tout est prêt pour progresser ensemble."}
            </Text>
          </View>
        </FadeInView>

        <FadeInView delay={120}>
          <View className="rounded-card bg-surface p-5 shadow-card">
            {/* Deux blocs distincts : ce qui est inclus gratuitement, et ce que
                Premium ajoute — l'ancienne liste unique annonçait rappels et
                multi-chevaux comme acquis, juste avant le paywall qui les
                présentait comme payants. */}
            <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">Inclus gratuitement</Text>
            <PlanRow text={`Planifie les séances de ${horseName}`} />
            {focus ? <PlanRow text={`Point à travailler : ${focus.toLowerCase()}`} /> : null}
            <PlanRow text="Note les rendez-vous santé : véto, maréchal, ostéo, dentiste" />
            <PlanRow text="Un rappel offert pour ton prochain soin" />
            <PlanRow text="Prépare tes concours et suis tes dépenses" />
          </View>
        </FadeInView>

        <FadeInView delay={170}>
          <View className="rounded-card border border-primary/30 bg-highlight/40 p-5">
            <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-primary">Avec Premium</Text>
            <PlanRow premium text="Un rappel avant chaque soin, sans limite" />
            {namedHorses.length > 1 ? (
              <PlanRow premium text={`${joinNames(namedHorses)} suivis dans la même écurie`} />
            ) : (
              <PlanRow premium text="Tous tes chevaux, sans limite" />
            )}
            <PlanRow premium text="Ordonnances et factures rangées au même endroit" />
            <PlanRow premium text="Partage avec ta demi-pension ou ton coach" />
          </View>
        </FadeInView>

      </ScrollView>

      <FadeInView delay={300}>
        <View className="px-5 pb-2 pt-3">
          <PrimaryButton label="Continuer" onPress={() => router.push("/(onboarding)/paywall")} />
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}
