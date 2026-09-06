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
import { OTHER_OPTION, RIDER_GOALS } from "@/onboarding/options";
import { colors } from "@/theme/colors";
import type { RiderGoal } from "@/onboarding/store";
import { useGoals } from "@/goals/store";
import { useHorses } from "@/horses/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Valeur locale au sélecteur de type, en plus des `RiderGoal` existants (cf.
 * garder les types existants) — même sentinelle `OTHER_OPTION` que
 * BreedField/CoatField/InjuryHistoryField pour "Autre / saisie libre" (cf.
 * onboarding/options.ts). Jamais envoyée comme `Goal.type` au serveur (enum
 * Postgres RiderGoal, cf. son commentaire sur goals/store.tsx) : elle pilote
 * seulement l'affichage du champ libre ci-dessous, `customType` porte le
 * texte réellement sauvegardé. */
type TypeSelection = RiderGoal | typeof OTHER_OPTION;

const TYPE_OPTIONS: { value: TypeSelection; label: string }[] = [
  ...RIDER_GOALS,
  { value: OTHER_OPTION, label: "Autre" },
];

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
  // Un objectif édité avec un customType déjà renseigné (cf. sa persistance
  // dans Goal, jamais avec `type` dans le même temps) rouvre directement sur
  // "Autre" — même logique que BreedField/CoatField pour une valeur qui ne
  // correspond à aucune option connue.
  const [type, setType] = useState<TypeSelection | null>(
    editing?.customType ? OTHER_OPTION : editing?.type ?? null
  );
  const [customType, setCustomType] = useState(editing?.customType ?? "");
  const [targetDate, setTargetDate] = useState<Date | null>(editing?.targetDate ?? null);
  const [horseId, setHorseId] = useState<string | null>(editing?.horseId ?? null);

  const horseOptions = horses.map((h) => ({ value: h.id, label: h.name }));
  const canSave = title.trim().length > 0;

  function submit() {
    if (!canSave) return;
    const payload = {
      title: title.trim(),
      type: type === OTHER_OPTION ? null : type,
      customType: type === OTHER_OPTION ? customType.trim() || null : null,
      targetDate,
      horseId,
    };
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
        <Text className="text-2xl font-display tracking-tight text-text">
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
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          placeholder="Sélectionner un type"
        />

        {type === OTHER_OPTION ? (
          <Field label="Précisez votre objectif">
            <TextInput
              className={INPUT}
              placeholder="Ex : Améliorer la souplesse à gauche"
              value={customType}
              onChangeText={setCustomType}
              autoCapitalize="sentences"
            />
          </Field>
        ) : null}

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
