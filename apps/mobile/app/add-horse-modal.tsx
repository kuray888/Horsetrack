import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton, SingleSelect, MultiSelectChips } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { DISCIPLINES, HORSE_LEVELS, HORSE_TRAITS } from "@/onboarding/options";
import { useHorses } from "@/horses/store";
import type { Discipline, HorseLevel } from "@/onboarding/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function AddHorseModal() {
  const { addHorse } = useHorses();
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [level, setLevel] = useState<HorseLevel | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);

  function submit() {
    if (!discipline || !level) return;
    addHorse({ name: name.trim(), discipline, level, strengths, weaknesses });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text">Ajouter un cheval</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-xl text-muted">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pt-6 pb-4" showsVerticalScrollIndicator={false}>
        <Field label="Nom du cheval">
          <TextInput
            className={INPUT}
            placeholder="Ex : Quabar des Monts"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Discipline travaillée">
          <SingleSelect options={DISCIPLINES} value={discipline} onChange={setDiscipline} />
        </Field>

        <Field label="Niveau du cheval">
          <SingleSelect options={HORSE_LEVELS} value={level} onChange={setLevel} />
        </Field>

        <Field label="Ses points forts 💪">
          <MultiSelectChips
            options={HORSE_TRAITS}
            values={strengths}
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
            onToggle={(t) => {
              setWeaknesses((w) => toggle(w, t));
              setStrengths((s) => s.filter((x) => x !== t));
            }}
          />
        </Field>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton
          label="Ajouter"
          disabled={name.trim().length === 0 || !discipline || !level}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}
