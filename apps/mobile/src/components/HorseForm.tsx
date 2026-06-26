import { useState } from "react";
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton, SingleSelect, MultiSelectChips } from "@/components/onboarding";
import { DropdownField } from "@/components/DropdownField";
import { BreedField } from "@/components/BreedField";
import { InjuryHistoryField, type InjuryEntry } from "@/components/InjuryHistoryField";
import { Field } from "@/components/Field";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import {
  DISCIPLINES,
  HEALTH_CONDITIONS,
  HORSE_FITNESS_LEVELS,
  HORSE_LEVELS,
  HORSE_SEXES,
  HORSE_TEMPERAMENTS,
  HORSE_TRAITS,
  HORSE_WORKLOADS,
  NO_HEALTH_CONDITION,
  REST_DAY_ACTIVITIES,
} from "@/onboarding/options";
import type { Injury, NewHorse } from "@/horses/store";
import { pickAndPersistImage } from "@/lib/imagePicker";
import type { Discipline, HorseFitnessLevel, HorseLevel, HorseSex, HorseWorkload } from "@/onboarding/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Comme NewHorse, mais discipline/niveau pas encore choisis tant que le
 * formulaire d'ajout est vide (l'édition reçoit toujours un Horse complet). */
export type HorseFormDraft = Omit<NewHorse, "discipline" | "level"> & {
  discipline: Discipline | null;
  level: HorseLevel | null;
};

export const EMPTY_HORSE_DRAFT: HorseFormDraft = {
  name: "",
  photoUrl: null,
  birthYear: null,
  sex: null,
  breed: null,
  heightCm: null,
  weightKg: null,
  discipline: null,
  level: null,
  fitnessLevel: null,
  workload: null,
  strengths: [],
  weaknesses: [],
  temperament: [],
  healthConditions: [],
  restDayActivities: [],
  injuries: [],
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function toggleHealthCondition(list: string[], value: string): string[] {
  if (value === NO_HEALTH_CONDITION) {
    return list.includes(NO_HEALTH_CONDITION) ? [] : [NO_HEALTH_CONDITION];
  }
  const withoutNone = list.filter((v) => v !== NO_HEALTH_CONDITION);
  return withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
}

function generateInjuryId(): string {
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Formulaire complet d'un cheval — partagé par l'ajout (depuis Profil) et
 * l'édition, pour rester à parité avec l'onboarding sans dupliquer ~15 champs
 * à chaque fois qu'on en ajoute un (cf. l'écart qu'on a dû corriger une fois déjà).
 */
export function HorseForm({
  title,
  initial,
  submitLabel,
  onSubmit,
}: {
  title: string;
  initial: HorseFormDraft;
  submitLabel: string;
  onSubmit: (horse: NewHorse) => void;
}) {
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(initial.name);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl);
  const [birthYear, setBirthYear] = useState<number | null>(initial.birthYear);
  const [sex, setSex] = useState<HorseSex | null>(initial.sex);
  const [breed, setBreed] = useState<string | null>(initial.breed);
  const [heightCm, setHeightCm] = useState<number | null>(initial.heightCm);
  const [weightKg, setWeightKg] = useState<number | null>(initial.weightKg);
  const [discipline, setDiscipline] = useState<Discipline | null>(initial.discipline);
  const [level, setLevel] = useState<HorseLevel | null>(initial.level);
  const [fitnessLevel, setFitnessLevel] = useState<HorseFitnessLevel | null>(initial.fitnessLevel);
  const [workload, setWorkload] = useState<HorseWorkload | null>(initial.workload);
  const [strengths, setStrengths] = useState<string[]>(initial.strengths);
  const [weaknesses, setWeaknesses] = useState<string[]>(initial.weaknesses);
  const [temperament, setTemperament] = useState<string[]>(initial.temperament);
  const [healthConditions, setHealthConditions] = useState<string[]>(initial.healthConditions);
  const [restDayActivities, setRestDayActivities] = useState<string[]>(initial.restDayActivities);
  const [injuries, setInjuries] = useState<Injury[]>(initial.injuries);

  async function pickPhoto() {
    const uri = await pickAndPersistImage();
    if (uri) setPhotoUrl(uri);
  }

  function submit() {
    if (!discipline || !level) return;
    onSubmit({
      name: name.trim(),
      photoUrl,
      birthYear,
      sex,
      breed,
      heightCm,
      weightKg,
      discipline,
      level,
      fitnessLevel,
      workload,
      strengths,
      weaknesses,
      temperament,
      healthConditions,
      restDayActivities,
      injuries,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text">{title}</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-xl text-muted">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pt-6 pb-4" showsVerticalScrollIndicator={false}>
        <View className="items-center">
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} className="h-24 w-24 rounded-full" />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full border border-dashed border-border bg-surface">
                <Text className="text-3xl">🐴</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text className="mt-2 text-xs text-muted">
            {photoUrl ? "Changer la photo" : "Ajouter une photo"}
          </Text>
        </View>

        <Field label="Nom du cheval">
          <TextInput
            className={INPUT}
            placeholder="Ex : Quabar des Monts"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Année de naissance">
          <TextInput
            className={INPUT}
            placeholder={`Ex : ${currentYear - 8}`}
            keyboardType="number-pad"
            maxLength={4}
            value={birthYear ? String(birthYear) : ""}
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              setBirthYear(Number.isNaN(n) ? null : n);
            }}
          />
        </Field>

        <Field label="Sexe">
          <SingleSelect options={HORSE_SEXES} value={sex} onChange={setSex} />
        </Field>

        <BreedField value={breed} onChange={setBreed} />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Taille au garrot (cm)">
              <TextInput
                className={INPUT}
                placeholder="Ex : 165"
                keyboardType="number-pad"
                maxLength={3}
                value={heightCm ? String(heightCm) : ""}
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  setHeightCm(Number.isNaN(n) ? null : n);
                }}
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Poids (kg)">
              <TextInput
                className={INPUT}
                placeholder="Ex : 550"
                keyboardType="number-pad"
                maxLength={4}
                value={weightKg ? String(weightKg) : ""}
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  setWeightKg(Number.isNaN(n) ? null : n);
                }}
              />
            </Field>
          </View>
        </View>

        <Field label="Discipline travaillée">
          <SingleSelect options={DISCIPLINES} value={discipline} onChange={setDiscipline} />
        </Field>

        <Field label="Niveau du cheval">
          <SingleSelect options={HORSE_LEVELS} value={level} onChange={setLevel} />
        </Field>

        <DropdownField
          label="Niveau de forme actuel"
          options={HORSE_FITNESS_LEVELS}
          value={fitnessLevel}
          onChange={setFitnessLevel}
          placeholder="Sélectionner la forme actuelle"
        />

        <DropdownField
          label="Charge de travail actuelle"
          options={HORSE_WORKLOADS}
          value={workload}
          onChange={setWorkload}
          placeholder="Sélectionner la charge de travail"
        />

        <Field label="Tempérament">
          <MultiSelectChips
            options={HORSE_TEMPERAMENTS}
            values={temperament}
            allowCustom
            onToggle={(t) => setTemperament((list) => toggle(list, t))}
          />
        </Field>

        <Field label="Ses points forts 💪">
          <MultiSelectChips
            options={HORSE_TRAITS}
            values={strengths}
            allowCustom
            onToggle={(t) => {
              setStrengths((s) => toggle(s, t));
              setWeaknesses((w) => w.filter((x) => x !== t));
            }}
          />
        </Field>

        <Field label="Ses points à travailler 🎯">
          <MultiSelectChips
            options={HORSE_TRAITS}
            values={weaknesses}
            allowCustom
            onToggle={(t) => {
              setWeaknesses((w) => toggle(w, t));
              setStrengths((s) => s.filter((x) => x !== t));
            }}
          />
        </Field>

        <Field label="Conditions de santé actuelles">
          <MultiSelectChips
            options={HEALTH_CONDITIONS}
            values={healthConditions}
            onToggle={(t) => setHealthConditions((list) => toggleHealthCondition(list, t))}
          />
        </Field>

        <InjuryHistoryField
          injuries={injuries.map((i): InjuryEntry => ({ ...i, key: i.id }))}
          onAdd={(entry) => setInjuries((list) => [...list, { ...entry, id: generateInjuryId() }])}
          onRemove={(key) => setInjuries((list) => list.filter((i) => i.id !== key))}
        />

        <Field label="Les jours sans séance, il est plutôt…">
          <Text className="text-xs text-muted">
            Plusieurs choix possibles : ils tournent d&apos;un jour de repos à l&apos;autre (ex. paddock un jour, box le suivant).
          </Text>
          <MultiSelectChips
            options={REST_DAY_ACTIVITIES}
            values={restDayActivities}
            allowCustom
            onToggle={(t) => setRestDayActivities((list) => toggle(list, t))}
          />
        </Field>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton
          label={submitLabel}
          disabled={name.trim().length === 0 || !discipline || !level}
          onPress={submit}
        />
      </View>
      <PickerOverlaySlot />
    </SafeAreaView>
  );
}
