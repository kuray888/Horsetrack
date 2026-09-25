import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { MultiSelectChips } from "@/components/onboarding";
import { InjuryHistoryField, type InjuryEntry } from "@/components/InjuryHistoryField";
import { HEALTH_CONDITIONS } from "@/onboarding/options";
import { useHorses, type Horse } from "@/horses/store";
import { healthConditionsState, knownHealthConditions, toggleHealthCondition } from "@/horses/healthConditions";
import { generateInjuryId, markInjuryRecovered, sortInjuriesRecentFirst } from "@/horses/injuries";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Antécédents de santé d'un cheval (problèmes connus + historique de
 * blessures), sur l'écran Santé. Ces informations sont saisies à la création
 * du cheval mais n'étaient affichées nulle part dans l'app — seulement dans le
 * texte de partage, cf. audit du 2026-09-19 (retour d'une utilisatrice).
 * Modifiables ici pour les compléter au fil du temps, sans repasser par tout
 * le formulaire du cheval. Lecture seule pour un cheval partagé : le
 * collaborateur consulte, seul le propriétaire écrit (cf. RLS horse_injuries).
 */
export function HealthHistory({ horse }: { horse: Horse }) {
  const { updateHorseHealth } = useHorses();
  const readOnly = horse.sharedRole !== null;
  const [editingConditions, setEditingConditions] = useState(false);

  const conditions = knownHealthConditions(horse.healthConditions);
  const state = healthConditionsState(horse.healthConditions);

  function confirmRemove(key: string) {
    const injury = horse.injuries.find((i) => i.id === key);
    Alert.alert("Retirer cette blessure ?", `${injury?.type ?? "Cette blessure"} sera retirée de l'historique de ${horse.name}.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: () => updateHorseHealth(horse.id, { injuries: horse.injuries.filter((i) => i.id !== key) }),
      },
    ]);
  }

  function confirmRecovered(key: string) {
    const injury = horse.injuries.find((i) => i.id === key);
    Alert.alert("Marquer comme rétablie ?", `${injury?.type ?? "Cette blessure"} restera dans l'historique, avec le statut « complètement rétabli ».`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Rétablie",
        onPress: () => updateHorseHealth(horse.id, { injuries: markInjuryRecovered(horse.injuries, key) }),
      },
    ]);
  }

  return (
    <View className={`${CARD} gap-4`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-muted">Antécédents</Text>

      <View className="gap-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-muted">Problèmes de santé connus</Text>
          {readOnly ? null : (
            <TouchableOpacity
              onPress={() => setEditingConditions((v) => !v)}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text className="text-sm font-semibold text-accent">{editingConditions ? "Terminer" : "Modifier"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {editingConditions ? (
          <MultiSelectChips
            options={HEALTH_CONDITIONS}
            values={horse.healthConditions}
            allowCustom
            onToggle={(t) => updateHorseHealth(horse.id, { healthConditions: toggleHealthCondition(horse.healthConditions, t) })}
          />
        ) : state === "listed" ? (
          <View className="flex-row flex-wrap gap-2">
            {conditions.map((c) => (
              <View key={c} className="rounded-full bg-highlight px-3 py-1.5">
                <Text className="text-sm font-semibold text-primary">{c}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">
            {state === "none" ? "Aucun problème connu." : "Non renseigné pour l'instant."}
          </Text>
        )}
      </View>

      <View className="h-px bg-border" />

      <InjuryHistoryField
        injuries={sortInjuriesRecentFirst(horse.injuries).map((i): InjuryEntry => ({ ...i, key: i.id }))}
        readOnly={readOnly}
        onAdd={(entry) => updateHorseHealth(horse.id, { injuries: [...horse.injuries, { ...entry, id: generateInjuryId() }] })}
        onRemove={confirmRemove}
        onMarkRecovered={confirmRecovered}
      />
    </View>
  );
}
