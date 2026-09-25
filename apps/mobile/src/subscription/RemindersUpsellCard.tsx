import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as SecureStore from "expo-secure-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";
import { FadeInView } from "@/components/FadeInView";
import { useAgenda } from "@/agenda/store";
import { useHorses } from "@/horses/store";
import { track } from "@/lib/analytics";
import { HEALTH_APPOINTMENT_TYPES } from "@/lib/progress";
import { useSubscription } from "./store";
import { openPaywall } from "./paywall";
import { shouldShowRemindersUpsell } from "./paywallLogic";

const DISMISSED_KEY = "reminders_upsell_dismissed_at_v1";


/**
 * Relance douce de l'Accueil (cf. paywallLogic.shouldShowRemindersUpsell) :
 * un compte gratuit qui note déjà ses rendez-vous santé se voit proposer les
 * rappels, au moment où leur utilité est évidente. Fermable, et absente
 * 14 jours après une fermeture — jamais au lancement ni sans contexte.
 */
export function RemindersUpsellCard() {
  const colors = useThemeColors();
  const { isActiveOrTrialing, loading } = useSubscription();
  const { appointments } = useAgenda();
  const { selectedHorse } = useHorses();
  // `undefined` tant que la date de fermeture n'est pas lue : rien n'est
  // affiché avant, pour ne pas faire clignoter une carte déjà fermée.
  const [dismissedAt, setDismissedAt] = useState<Date | null | undefined>(undefined);
  const viewed = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(DISMISSED_KEY)
      .then((raw) => setDismissedAt(raw ? new Date(raw) : null))
      .catch(() => setDismissedAt(null));
  }, []);

  const healthCount = useMemo(() => appointments.filter((a) => HEALTH_APPOINTMENT_TYPES.has(a.type)).length, [appointments]);
  const visible =
    !loading &&
    dismissedAt !== undefined &&
    shouldShowRemindersUpsell({ premium: isActiveOrTrialing, healthAppointments: healthCount, dismissedAt });

  useEffect(() => {
    if (visible && !viewed.current) {
      viewed.current = true;
      track("upsell_card_viewed", { card: "reminders", health_appointments: healthCount });
    }
  }, [visible, healthCount]);

  if (!visible) return null;

  function dismiss() {
    const now = new Date();
    setDismissedAt(now);
    track("upsell_card_dismissed", { card: "reminders" });
    SecureStore.setItemAsync(DISMISSED_KEY, now.toISOString()).catch(() => {});
  }

  const name = selectedHorse?.name ?? "ton cheval";
  // Le fondu est porté ici, pas par l'appelant : un conteneur animé laissé
  // dans la page quand la carte est masquée y ajouterait un espace vide.
  return (
    <FadeInView delay={59}>
    <View className="gap-3 rounded-card bg-highlight p-4">
      <View className="flex-row items-start gap-3">
        <MaterialCommunityIcons name="bell-ring-outline" size={22} color={colors.primary} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-bold text-text">Veux-tu qu&apos;on te prévienne avant le prochain soin de {name} ?</Text>
          <Text className="text-sm text-muted">Avec Premium, une notification avant chaque véto, maréchal ou vaccin.</Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => openPaywall("reminders", { feature: "home_upsell_card" })}
        activeOpacity={0.85}
        className="self-start rounded-full bg-primary px-5 py-2.5"
      >
        <Text className="text-sm font-bold text-on-primary">Découvrir les rappels</Text>
      </TouchableOpacity>
    </View>
    </FadeInView>
  );
}
