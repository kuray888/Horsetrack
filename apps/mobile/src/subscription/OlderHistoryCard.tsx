import { useEffect } from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { openPaywall, useTrialConfirmed } from "@/subscription/paywall";
import { FREE_HISTORY_DAYS } from "@/subscription/freeTier";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

/**
 * Fin de liste d'un compte gratuit resserré (cf. subscription/freeTier.ts) :
 * dit combien d'entrées plus anciennes sont gardées et comment les revoir.
 * Rien n'est supprimé : elles réapparaissent avec Premium.
 */
export function OlderHistoryCard({
  hiddenCount,
  surface,
  horseId,
}: {
  hiddenCount: number;
  /** Écran d'où vient le verrou, pour l'analytics. */
  surface: "history" | "journal";
  horseId?: string;
}) {
  const colors = useThemeColors();
  const trialConfirmed = useTrialConfirmed();
  useEffect(() => {
    if (hiddenCount > 0) track("history_limit_reached", { surface, hidden: hiddenCount });
  }, [hiddenCount > 0, surface]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hiddenCount <= 0) return null;
  return (
    <View className="items-center gap-3 rounded-card bg-surface p-5 shadow-card">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-highlight" accessible={false}>
        <MaterialCommunityIcons name="history" size={20} color={colors.primary} />
      </View>
      <Text className="text-center text-base font-semibold text-text">
        {t("{count} entrée(s) plus ancienne(s), gardée(s) pour toi", { count: hiddenCount })}
      </Text>
      <Text className="text-center text-sm text-muted">
        {t("La version gratuite affiche les {days} derniers jours. Premium te rend tout l'historique.", { days: FREE_HISTORY_DAYS })}
      </Text>
      <PrimaryButton
        label={trialConfirmed ? t("Essayer gratuitement") : t("Découvrir Premium")}
        onPress={() => openPaywall("history", { feature: `history_${surface}`, horseId })}
      />
    </View>
  );
}
