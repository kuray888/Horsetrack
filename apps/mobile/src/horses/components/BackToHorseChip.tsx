import { useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useHorses } from "@/horses/store";
import { useThemeColors } from "@/theme/ThemeProvider";
import { hapticTap } from "@/lib/haptics";
import { t } from "@/i18n";

/**
 * « ‹ Nom du cheval » en haut du Planning ou du Journal quand on y arrive
 * depuis une tuile de la fiche cheval (Entraînement, Concours, Journal) : la
 * fiche, empilée au-dessus des onglets, se ferme pour éviter une seconde
 * instance des onglets (cf. horseHubNavigation.test.ts), et le bouton Retour
 * n'y ramenait plus. Ce bouton la rouvre. Il disparaît dès qu'on quitte
 * l'onglet : revenir plus tard par la barre d'onglets ne le montre plus.
 */
export function BackToHorseChip() {
  const { fromHorse } = useLocalSearchParams<{ fromHorse?: string }>();
  const navigation = useNavigation();
  const { horses } = useHorses();
  const colors = useThemeColors();
  const horse = fromHorse ? horses.find((h) => h.id === fromHorse) : undefined;

  useEffect(() => {
    if (!fromHorse) return;
    const unsubscribe = navigation.addListener("blur", () => {
      navigation.setParams({ fromHorse: undefined } as never);
    });
    return unsubscribe;
  }, [fromHorse, navigation]);

  if (!horse) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("Retour à la fiche de {name}", { name: horse.name })}
      onPress={() => {
        hapticTap();
        navigation.setParams({ fromHorse: undefined } as never);
        router.push(`/horse/${horse.id}`);
      }}
      hitSlop={8}
      className="-ml-2 min-h-[44px] flex-row items-center self-start"
    >
      <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} accessibilityElementsHidden />
      <Text className="text-subhead font-semibold text-link" numberOfLines={1}>
        {horse.name}
      </Text>
    </TouchableOpacity>
  );
}
