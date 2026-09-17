import { Alert, View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { OnboardingShell } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES, TOTAL_STEPS } from "@/onboarding/options";
import { colors } from "@/theme/colors";

function disciplineLabel(value: string | null): string {
  return DISCIPLINES.find((d) => d.value === value)?.label ?? "—";
}

export default function Horses() {
  const { rider, horses, startNewHorse, editHorse, removeHorse } = useOnboarding();
  const namedHorses = horses.filter((h) => h.name.trim().length > 0);

  function addAnother() {
    // Avertit AVANT de faire remplir une fiche complète plutôt qu'après (cf.
    // audit du 2026-09-16) : la troncature au palier gratuit n'arrivait
    // qu'au paywall final, laissant l'utilisateur découvrir après coup
    // qu'un cheval qu'il venait de détailler (race, robe, traits, santé...)
    // ne serait pas gardé. Ne s'affiche qu'à partir du 2ᵉ cheval — le
    // premier est toujours inclus au palier gratuit.
    if (namedHorses.length >= 1) {
      Alert.alert(
        "Un seul cheval sur le palier gratuit",
        "Tu peux ajouter ce cheval, mais il ne sera conservé qu'avec Horsetrack Premium — sinon seul ton premier cheval restera à la fin de l'inscription.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Continuer",
            onPress: () => {
              startNewHorse();
              router.push("/(onboarding)/horse-basics");
            },
          },
        ]
      );
      return;
    }
    startNewHorse();
    router.push("/(onboarding)/horse-basics");
  }

  return (
    <OnboardingShell
      step={6}
      total={TOTAL_STEPS}
      title="Ton écurie"
      subtitle="Ajoute tous les chevaux de ton écurie — le premier est gratuit, les suivants avec Horsetrack Premium."
      ctaLabel="C'est tout, continuer"
      onNext={() => router.push("/(onboarding)/summary")}
    >
      <View className="gap-3">
        {namedHorses.map((h, i) => (
          <View
            key={h.localId}
            className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-highlight">
              <MaterialCommunityIcons name="horse-variant" size={22} color={colors.primary} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-base font-bold text-text">{h.name}</Text>
                {h.isPrimary ? <MaterialCommunityIcons name="star" size={13} color={colors.warning} /> : null}
              </View>
              {/* Le profil sportif n'est plus demandé ici (cf. onboarding/options.ts) :
                  tant qu'il n'a pas été personnalisé sur la fiche du cheval,
                  reflète la discipline déjà déclarée par le cavalier plutôt
                  qu'un "—" vide et trompeur (paywall.tsx applique le même
                  défaut à la création réelle du cheval). */}
              <Text className="text-sm text-muted">{disciplineLabel(h.discipline ?? rider.mainDiscipline)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                editHorse(horses.indexOf(h));
                router.push("/(onboarding)/horse-basics");
              }}
              hitSlop={8}
            >
              <Text className="px-2 text-sm font-semibold text-accent">Modifier</Text>
            </TouchableOpacity>
            {namedHorses.length > 1 ? (
              <TouchableOpacity
                onPress={() => removeHorse(h.localId)}
                hitSlop={8}
                accessibilityLabel={`Retirer ${h.name}`}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={16} color={colors.danger} accessibilityElementsHidden />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <TouchableOpacity
          onPress={addAnother}
          activeOpacity={0.8}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
          <Text className="text-base font-semibold text-primary">Ajouter un autre cheval</Text>
        </TouchableOpacity>
      </View>
    </OnboardingShell>
  );
}
