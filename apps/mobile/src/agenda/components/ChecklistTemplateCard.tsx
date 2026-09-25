import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import {
  DEFAULT_CHECKLIST_LABELS,
  MAX_CHECKLIST_ITEMS,
  normalizeChecklistLabels,
} from "@/agenda/checklistTemplate";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface px-3 py-2.5 text-sm text-text";

/** Checklist type des concours : on la règle une fois, et « Enregistrer »
 * l'applique à TOUS les concours à venir (cf. saveChecklistTemplate dans
 * agenda/store.tsx) — ceux qu'on créera ensuite partent de la même liste.
 *
 * Chaque concours garde sa propre copie, cochable et modifiable
 * individuellement depuis sa carte : ce qu'on coche pour un concours ne bouge
 * jamais la liste type. */
export function ChecklistTemplateCard({
  template,
  onSave,
}: {
  template: string[];
  /** Renvoie le nombre de concours à venir mis à jour. */
  onSave: (labels: string[]) => number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(template);
  const [newLabel, setNewLabel] = useState("");

  function startEditing() {
    setDraft(template);
    setNewLabel("");
    setEditing(true);
  }

  function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    setDraft((list) => [...list, label]);
    setNewLabel("");
  }

  function handleSave() {
    // Un élément saisi mais pas encore ajouté (touche « + » oubliée) part
    // quand même : l'enregistrement d'une liste qui ignore ce qu'on vient de
    // taper serait une perte silencieuse.
    const pending = newLabel.trim();
    const labels = normalizeChecklistLabels(pending ? [...draft, pending] : draft);
    const updated = onSave(labels);
    setEditing(false);
    setNewLabel("");
    Alert.alert(
      "Checklist enregistrée",
      updated > 0
        ? `Appliquée à ${updated} concours à venir. Les prochains concours partiront de cette liste.`
        : "Aucun concours à venir pour l'instant : les prochains partiront de cette liste."
    );
  }

  if (!editing) {
    return (
      <View className={`${CARD} gap-2`}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Checklist des concours</Text>
            <Text className="text-sm text-muted">
              {template.length} élément{template.length > 1 ? "s" : ""} · modèle appliqué à tous tes concours à venir
            </Text>
          </View>
          <TouchableOpacity
            onPress={startEditing}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Modifier la checklist des concours"
            className="flex-row items-center gap-1.5 rounded-full border border-border px-3.5 py-2"
          >
            <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.textMuted} accessibilityElementsHidden />
            <Text className="text-sm font-semibold text-text">Modifier</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">Checklist des concours</Text>
      <Text className="text-sm text-muted">
        Modifie la liste, puis enregistre : elle s&apos;applique à tous tes concours à venir. Ce que tu as déjà coché
        est conservé.
      </Text>

      <View className="gap-2">
        {draft.map((label, index) => (
          <View key={index} className="flex-row items-center gap-2">
            <TextInput
              className={`${INPUT} flex-1`}
              value={label}
              onChangeText={(text) => setDraft((list) => list.map((l, i) => (i === index ? text : l)))}
              accessibilityLabel={`Élément ${index + 1}`}
            />
            <TouchableOpacity
              onPress={() => setDraft((list) => list.filter((_, i) => i !== index))}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${label || "cet élément"}`}
            >
              <Text className="text-sm text-muted">✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {draft.length === 0 ? <Text className="text-sm text-muted">Aucun élément pour l&apos;instant.</Text> : null}
      </View>

      {draft.length < MAX_CHECKLIST_ITEMS ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            className={`${INPUT} flex-1`}
            placeholder="Ajouter un élément…"
            value={newLabel}
            onChangeText={setNewLabel}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={addItem}
            disabled={!newLabel.trim()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ajouter l'élément"
            className={`h-9 w-9 items-center justify-center rounded-full ${newLabel.trim() ? "bg-primary" : "bg-border"}`}
          >
            <Text className={`text-base font-bold ${newLabel.trim() ? "text-on-primary" : "text-muted"}`}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text className="text-xs text-muted">Maximum {MAX_CHECKLIST_ITEMS} éléments.</Text>
      )}

      <TouchableOpacity onPress={() => setDraft([...DEFAULT_CHECKLIST_LABELS])} activeOpacity={0.7} className="self-start">
        <Text className="text-sm font-semibold text-accent">Revenir à la liste d&apos;origine</Text>
      </TouchableOpacity>

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => setEditing(false)}
          className="flex-1 items-center rounded-card border border-border p-4"
        >
          <Text className="text-base font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.85} className="flex-1 items-center rounded-card bg-primary p-4">
          <Text className="text-center text-base font-bold text-on-primary">Enregistrer pour tous les concours à venir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
