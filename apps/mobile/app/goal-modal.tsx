import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { DropdownField } from "@/components/DropdownField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { RIDER_GOALS } from "@/onboarding/options";
import { colors } from "@/theme/colors";
import type { RiderGoal } from "@/onboarding/store";
import { useGoals } from "@/goals/store";
import { useHorses } from "@/horses/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Ajout/édition d'un objectif — un seul écran pour les deux cas (cf. `id` en
 * paramètre), le formulaire étant trop simple pour justifier deux fichiers
 * quasi identiques (contrairement à HorseForm, partagé mais bien plus long).
 */
export default function GoalModal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  const { horses } = useHorses();
  const editing = id ? goals.find((g) => g.id === id) : undefined;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [type, setType] = useState<RiderGoal | null>(editing?.type ?? null);
  const [targetDate, setTargetDate] = useState<Date | null>(editing?.targetDate ?? null);
  const [horseId, setHorseId] = useState<string | null>(editing?.horseId ?? null);

  const horseOptions = horses.map((h) => ({ value: h.id, label: h.name }));
  const canSave = title.trim().length > 0;

  function submit() {
    if (!canSave) return;
    const payload = { title: title.trim(), type, targetDate, horseId };
    if (editing) updateGoal(editing.id, payload);
    else addGoal(payload);
    router.back();
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert("Supprimer cet objectif ?", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deleteGoal(editing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text">
          {editing ? "Modifier l'objectif" : "Nouvel objectif"}
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pt-6 pb-4" showsVerticalScrollIndicator={false}>
        <Field label="Titre">
          <TextInput
            className={INPUT}
            placeholder="Ex : Réussir le concours de printemps"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />
        </Field>

        <DropdownField
          label="Type d'objectif (optionnel)"
          options={RIDER_GOALS}
          value={type}
          onChange={setType}
          placeholder="Sélectionner un type"
        />

        <DatePickerField label="Date cible (optionnel)" value={targetDate} onChange={setTargetDate} />

        {horseOptions.length > 0 ? (
          <DropdownField
            label="Cheval concerné (optionnel)"
            options={horseOptions}
            value={horseId}
            onChange={setHorseId}
            placeholder="Aucun cheval en particulier"
          />
        ) : null}

        {editing ? (
          <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} className="items-center py-2">
            <Text className="text-sm font-semibold text-danger">Supprimer cet objectif</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton label={editing ? "Enregistrer" : "Ajouter"} disabled={!canSave} onPress={submit} />
      </View>
      <PickerOverlaySlot />
    </SafeAreaView>
  );
}
