import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { listCollaborators } from "@/lib/sharing";
import { track } from "@/lib/analytics";
import { useSubscription } from "@/subscription/store";
import { t } from "@/i18n";

const DISMISS_DAYS = 30;
const dismissKey = (horseId: string) => `invite_partner_dismissed_${horseId}`;

/**
 * La fiche Demi-pension nomme déjà la cavalière, mais le cheval n'est
 * partagé avec personne : on propose de l'inviter. Chaque invitée devient
 * une utilisatrice (le partage fait connaître l'app) et le propriétaire
 * gagne un planning commun. Gratuit : une invitation en lecture seule.
 * Rien n'est affiché sans confirmation du serveur qu'aucun collaborateur
 * n'existe (hors ligne : rien), ni pendant 30 jours après une fermeture.
 */
export function InvitePartnerCard({ horseId, horseName, partnerName }: { horseId: string; horseName: string; partnerName: string }) {
  const colors = useThemeColors();
  const { isActiveOrTrialing } = useSubscription();
  const [visible, setVisible] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(dismissKey(horseId));
        if (raw && Date.now() - new Date(raw).getTime() < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
        const collaborators = await listCollaborators(horseId);
        if (!cancelled && collaborators !== null && collaborators.length === 0) setVisible(true);
      } catch {
        // Best-effort : sans réponse sûre, pas de carte.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [horseId]);

  useEffect(() => {
    if (visible && !viewed.current) {
      viewed.current = true;
      track("upsell_card_viewed", { card: "invite_partner", premium: isActiveOrTrialing });
    }
  }, [visible, isActiveOrTrialing]);

  if (!visible) return null;

  function invite() {
    track("invite_partner_card_tapped", { premium: isActiveOrTrialing });
    // Gratuit aussi : une invitation en lecture seule (cf. lib/shareRoles.ts).
    router.push(`/share-horse-modal?horseId=${horseId}`);
  }

  function dismiss() {
    setVisible(false);
    track("upsell_card_dismissed", { card: "invite_partner" });
    SecureStore.setItemAsync(dismissKey(horseId), new Date().toISOString()).catch(() => {});
  }

  return (
    <FadeInView>
      <View className="gap-3 rounded-card bg-highlight p-4">
        <View className="flex-row items-start gap-3">
          <MaterialCommunityIcons name="account-multiple-plus-outline" size={22} color={colors.primary} />
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold text-text">
              {t("Invite {partner} à suivre {horse}", { partner: partnerName, horse: horseName })}
            </Text>
            <Text className="text-sm text-muted">
              {t("Planning, soins et rendez-vous à jour pour vous deux, et un fil privé pour échanger.")}
            </Text>
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={invite}
          activeOpacity={0.85}
          accessibilityRole="button"
          testID="invite-partner"
          className="items-center rounded-card bg-primary p-3"
        >
          <Text className="text-sm font-bold text-on-primary">{t("Inviter {partner}", { partner: partnerName })}</Text>
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}
