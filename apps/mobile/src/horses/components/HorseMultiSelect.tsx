import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";
import { Field } from "@/components/Field";
import { resolveTargetHorseIds, toggleHorseId } from "@/horses/selectableHorses";

/** « Pour quel(s) cheval(aux) ? » — cases à cocher pour créer la même entrée
 * pour plusieurs chevaux d'un coup (cf. useAppointmentForm, qui boucle
 * ensuite chevaux × dates de récurrence). Répond au cas réel n°1 : un
 * maréchal, un vaccin ou un vermifuge se programme presque toujours pour
 * toute l'écurie le même jour, et il fallait jusqu'ici retaper le rendez-vous
 * cheval par cheval en changeant le cheval actif entre chaque.
 *
 * Ne s'affiche qu'à partir de deux chevaux utilisables — l'appelant filtre en
 * amont via `shouldOfferHorseChoice` — et jamais en édition : chaque entrée
 * créée est une copie indépendante, on ne réaffecte pas après coup.
 *
 * `value` vide signifie « aucun choix explicite », donc le cheval actif seul
 * (cf. resolveTargetHorseIds) : l'affichage matérialise ce défaut en cochant
 * le cheval actif, sans avoir à écrire cet état au montage.
 *
 * Distinct de HorseSwitcher, qui change le cheval ACTIF de toute l'app : ici
 * on ne choisit que les destinataires de l'entrée en cours de saisie, rien
 * n'est changé globalement. D'où des cases à cocher plutôt que des avatars. */
export function HorseMultiSelect({
  horses,
  activeHorseId,
  value,
  onChange,
  label = "Pour quel(s) cheval(aux) ?",
}: {
  horses: { id: string; name: string }[];
  activeHorseId: string | null;
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const colors = useThemeColors();
  const selectedIds = resolveTargetHorseIds(value, horses, activeHorseId);

  return (
    <Field label={label}>
      <View className="flex-row flex-wrap gap-2">
        {horses.map((h) => {
          const selected = selectedIds.includes(h.id);
          return (
            <TouchableOpacity
              key={h.id}
              onPress={() => onChange(toggleHorseId(value, h.id, activeHorseId))}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityLabel={h.name}
              accessibilityState={{ checked: selected }}
              className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
                selected ? "border-primary bg-highlight" : "border-border bg-surface"
              }`}
            >
              <MaterialCommunityIcons
                name={selected ? "check-circle" : "circle-outline"}
                size={15}
                color={selected ? colors.primary : colors.textMuted}
                accessibilityElementsHidden
              />
              <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{h.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedIds.length > 1 ? (
        <Text className="text-xs text-muted">
          {selectedIds.length} entrées distinctes seront créées, une par cheval — les modifier ou les supprimer ensuite
          se fait cheval par cheval.
        </Text>
      ) : null}
    </Field>
  );
}
