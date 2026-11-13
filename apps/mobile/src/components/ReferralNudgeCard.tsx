import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/haptics";
import { closeReferralNudgeCard, readReferralNudge } from "@/lib/referralNudge";
import { shouldShowReferralNudge } from "@/lib/referralNudgeLogic";
import { t } from "@/i18n";

/**
 * « Un ami monte aussi ? » sur l'Accueil, après plusieurs moments positifs
 * (plafonds dans referralNudgeLogic.ts, ligne du tableau des relances de
 * CLAUDE.md). Mène à l'écran de parrainage existant.
 */
export function ReferralNudgeCard() {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    readReferralNudge()
      .then((s) => setVisible(shouldShowReferralNudge(s, new Date())))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (visible && !viewed.current) {
      viewed.current = true;
      track("referral_nudge_viewed");
    }
  }, [visible]);

  if (!visible) return null;

  function close(how: "dismissed" | "opened") {
    setVisible(false);
    closeReferralNudgeCard(how);
    track(how === "opened" ? "referral_nudge_opened" : "referral_nudge_dismissed");
  }

  return (
    <FadeInView delay={59}>
      <View className="gap-3 rounded-card bg-highlight p-4">
        <View className="flex-row items-start gap-3">
          <MaterialCommunityIcons name="gift-outline" size={22} color={colors.primary} accessibilityElementsHidden />
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold text-text">{t("Un ami cavalier aimerait Horsetrack ?")}</Text>
            <Text className="text-sm text-muted">{t("Partage ton code : quand il s'abonne, tu gagnes un mois de Premium.")}</Text>
          </View>
          <TouchableOpacity onPress={() => close("dismissed")} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => {
            hapticTap();
            close("opened");
            router.push("/referral");
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          className="self-start rounded-full bg-primary px-5 py-2"
        >
          <Text className="text-sm font-bold text-on-primary">{t("Parrainer un ami")}</Text>
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}
