import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { openLegalPage } from "@/lib/links";
import { track } from "@/lib/analytics";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { useCoachConsent } from "@/coach/useCoachConsent";
import { t } from "@/i18n";

/**
 * Demande d'accord avant le premier envoi du carnet à l'IA (cf.
 * coach/consent.ts, règle 5.1.2(i) de l'App Store). Dit CE qui part, À QUI et
 * où, et ce qui n'est pas envoyé. Tant qu'elle n'est pas acceptée, rien ne
 * quitte le téléphone.
 *
 * `onDecline` : « Pas maintenant » (ferme la demande, sans rien envoyer).
 */
export function CoachConsentCard({ onDecline }: { onDecline?: () => void }) {
  const colors = useThemeColors();
  const { grant } = useCoachConsent();

  async function accept() {
    await grant();
    hapticSuccess();
    animateNextLayout();
    track("coach_consent_given");
  }

  return (
    <View className="gap-3 rounded-card bg-surface p-5 shadow-card" testID="coach-consent">
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} />
        <Text className="flex-1 text-lg font-bold text-text" accessibilityRole="header">
          {t("Autoriser le coach IA ?")}
        </Text>
      </View>
      <Text className="text-[15px] leading-5 text-text">
        {t("Pour répondre, le coach envoie le carnet de ton cheval (séances, soins, dépenses, poids) et le texte de tes questions à Anthropic, notre prestataire d'intelligence artificielle, aux États-Unis.")}
      </Text>
      <Text className="text-sm leading-5 text-muted">
        {t("Ni ton nom, ni ton e-mail, ni le nom de ton cheval ne sont envoyés. Anthropic n'utilise pas ces données pour entraîner ses modèles. Tu peux retirer ton accord à tout moment, depuis l'écran du coach.")}
      </Text>
      <PrimaryButton label={t("J'autorise")} onPress={() => void accept()} testID="coach-consent-accept" />
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        {onDecline ? (
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              hapticSelection();
              track("coach_consent_declined");
              onDecline();
            }}
          >
            <Text className="text-sm font-semibold text-muted">{t("Pas maintenant")}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <TouchableOpacity accessibilityRole="link" hitSlop={8} onPress={() => void openLegalPage("privacy")}>
          <Text className="text-sm font-semibold text-accent">{t("Politique de confidentialité")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
