import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useAgenda, daysFromNow, type Appointment } from "@/agenda/store";
import { APPT_META, HEALTH_APPT_TYPES, daysUntilLabel } from "@/agenda/meta";
import { formatDate } from "@/lib/dateFormat";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Historique santé — vue chronologique en lecture seule (cf. audit produit
 * mini-sprint, phase 3) : quoi/quand/statut/prochaine échéance, à partir des
 * Appointment de type soin déjà existants (HEALTH_APPT_TYPES, cf. agenda/meta.ts)
 * — aucun nouveau modèle DB. La création/édition complète reste dans l'ancien
 * Agenda (lien en bas), volontairement pas dupliquée ici : cet écran ne fait
 * que rendre lisible ce qui existe déjà, remplace l'ancien simple redirect
 * vers Agenda section "Rendez-vous".
 */
export default function HorseSanteScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, selectedHorse, selectHorse } = useHorses();
  const { appointments } = useAgenda();

  const horse = horses.find((h) => h.id === id);

  // Même garantie que le Horse Hub : consulter cet écran rend ce cheval actif,
  // pas de double sélection si l'utilisateur veut ensuite agir dessus
  // (Quick Add, ancien Agenda...).
  useEffect(() => {
    if (horse && selectedHorse?.id !== horse.id) selectHorse(horse.id);
  }, [horse, selectedHorse?.id, selectHorse]);

  if (!horse) {
    return (
      <Screen>
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">Ce cheval est introuvable.</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  const today = daysFromNow(0);
  const history = appointments
    .filter((a) => a.horseId === horse.id && (HEALTH_APPT_TYPES as readonly string[]).includes(a.type))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  function statusFor(appt: Appointment): { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string } {
    if (appt.date <= today) return { label: "Effectué", icon: "check-circle-outline", color: colors.success };
    return { label: `À venir · ${daysUntilLabel(appt.date)}`, icon: "clock-outline", color: colors.warning };
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-display tracking-tight text-text">Santé</Text>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        {history.length === 0 ? (
          <FadeInView delay={60}>
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="heart-pulse" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-sm text-muted">
                Rien à afficher pour l&apos;instant : les soins de {horse.name} apparaîtront ici.
              </Text>
            </View>
          </FadeInView>
        ) : (
          <FadeInView delay={60}>
            <View className="gap-2">
              {history.map((appt) => {
                const meta = APPT_META[appt.type];
                const status = statusFor(appt);
                // "jusqu'au [prochaine échéance]" pour un traitement en cours
                // (durée), simple ligne "Prochaine échéance" pour les autres
                // types (vaccin, vermifuge...) — même champ nextDueDate déjà
                // existant, pas de nouvelle donnée.
                const isTreatmentRange = appt.type === "traitement" && appt.nextDueDate;
                return (
                  <View key={appt.id} className={`${CARD} flex-row items-center gap-3`}>
                    <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
                      <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-base font-bold text-text">{meta.label}</Text>
                      <Text className="text-sm text-muted">
                        {isTreatmentRange
                          ? `${formatDate(appt.date)} → ${formatDate(appt.nextDueDate!)}`
                          : formatDate(appt.date)}
                        {appt.professional ? ` · ${appt.professional}` : ""}
                      </Text>
                      {!isTreatmentRange && appt.nextDueDate ? (
                        <Text className="text-xs text-accent">
                          Prochaine échéance : {formatDate(appt.nextDueDate)}
                        </Text>
                      ) : null}
                    </View>
                    <View className="flex-row items-center gap-1">
                      <MaterialCommunityIcons name={status.icon} size={14} color={status.color} />
                      <Text className="text-xs font-semibold" style={{ color: status.color }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </FadeInView>
        )}

        <FadeInView delay={100}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/agenda?section=appointments")}
            activeOpacity={0.7}
            className="items-center py-2"
          >
            <Text className="text-sm font-semibold text-accent">Ajouter ou modifier un rendez-vous santé</Text>
          </TouchableOpacity>
        </FadeInView>
      </Screen>
    </>
  );
}
