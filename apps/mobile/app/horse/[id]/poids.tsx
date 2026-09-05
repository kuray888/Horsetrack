import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { PrimaryButton } from "@/components/onboarding";
import { AddToggle } from "@/components/FormChips";
import { useThemeColors } from "@/theme/ThemeProvider";
import { formatDate } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { useWeight } from "@/horses/weightStore";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Suivi de poids (audit produit post-V1, phase 5) — un historique de mesures
 * par cheval, volontairement simple : ni graphique, ni module médical, juste
 * le poids actuel, la tendance depuis la dernière mesure, et la liste des
 * mesures passées (cf. horses/weightStore.tsx pour la persistance/sync).
 */
export default function HorseWeightScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, selectedHorse } = useHorses();
  const { measurements, addMeasurement, deleteMeasurement } = useWeight();

  const horse = horses.find((h) => h.id === id);
  const isActiveHorse = selectedHorse?.id === id;

  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());

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

  const horseMeasurements = measurements
    .filter((m) => m.horseId === horse.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const previous = horseMeasurements[1] ?? null;
  const trend = previous ? horseMeasurements[0].weightKg - previous.weightKg : null;

  function handleAdd() {
    const parsed = Number(weightInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0 || !date) return;
    // Le suivi de poids est rattaché au cheval sélectionné globalement (cf.
    // weightStore.tsx addMeasurement) — même garantie que Quick Add/Journal :
    // pas de deuxième sélection si ce n'est pas le cheval actif.
    if (!isActiveHorse) {
      Alert.alert(
        "Cheval non actif",
        `Sélectionne d'abord ${horse!.name} comme cheval actif (Chevaux) pour lui ajouter une mesure.`
      );
      return;
    }
    addMeasurement(Math.round(parsed), date);
    setWeightInput("");
    setDate(new Date());
    setShowForm(false);
  }

  function confirmDelete(measurementId: string) {
    Alert.alert("Supprimer cette mesure ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteMeasurement(measurementId) },
    ]);
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-display tracking-tight text-text">Poids</Text>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <View className={`${CARD} items-center gap-1.5`}>
            {horse.weightKg ? (
              <>
                <Text className="text-4xl font-display-bold text-text">{horse.weightKg} kg</Text>
                {horseMeasurements[0] ? (
                  <Text className="text-sm text-muted">Dernière mesure : {formatDate(horseMeasurements[0].date)}</Text>
                ) : null}
                {trend !== null ? (
                  <View className="mt-1 flex-row items-center gap-1">
                    <MaterialCommunityIcons
                      name={trend > 0 ? "trending-up" : trend < 0 ? "trending-down" : "trending-neutral"}
                      size={16}
                      color={trend > 0 ? colors.warning : trend < 0 ? colors.accent : colors.textMuted}
                    />
                    <Text className="text-sm font-semibold text-muted">
                      {trend > 0 ? "+" : ""}
                      {trend} kg depuis la mesure précédente
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text className="text-sm text-muted">Aucune mesure pour l&apos;instant.</Text>
            )}
          </View>
        </FadeInView>

        <FadeInView delay={100}>
          {showForm ? (
            <View className={`${CARD} gap-3`}>
              <Text className="text-sm font-bold uppercase tracking-wide text-accent">Nouvelle mesure</Text>
              <Field label="Poids (kg)">
                <TextInput
                  className={INPUT}
                  placeholder="Ex : 540"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                />
              </Field>
              <DatePickerField label="Date" value={date} onChange={setDate} />
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowForm(false)}
                  className="flex-1 items-center rounded-card border border-border p-4"
                >
                  <Text className="text-base font-semibold text-muted">Annuler</Text>
                </TouchableOpacity>
                <View className="flex-1">
                  <PrimaryButton
                    label="Ajouter"
                    disabled={!weightInput.trim() || !date}
                    onPress={handleAdd}
                  />
                </View>
              </View>
            </View>
          ) : (
            <AddToggle label="Ajouter une mesure" onPress={() => setShowForm(true)} color={colors.primary} />
          )}
        </FadeInView>

        {horseMeasurements.length > 0 ? (
          <FadeInView delay={140}>
            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted">Historique</Text>
              {horseMeasurements.map((m) => (
                <View key={m.id} className={`${CARD} flex-row items-center justify-between`}>
                  <View className="gap-0.5">
                    <Text className="text-base font-bold text-text">{m.weightKg} kg</Text>
                    <Text className="text-sm text-muted">{formatDate(m.date)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(m.id)} hitSlop={8} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </FadeInView>
        ) : null}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
