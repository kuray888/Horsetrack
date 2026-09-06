import { Animated, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";
import { colors as staticColors } from "@/theme/colors";
import { usePressScale } from "@/hooks/usePressScale";
import { formatDate } from "@/lib/dateFormat";
import { ACTIVITY_META } from "@/agenda/store";
import type { IconSpec } from "@/components/FormChips";
import type { SessionIntensity, TrainingSession } from "@/sessions/store";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export const INTENSITY_META: Record<SessionIntensity, { label: string; icon: IconSpec }> = {
  low: { label: "Légère", icon: { name: "circle", color: staticColors.success } },
  medium: { label: "Modérée", icon: { name: "circle", color: staticColors.warning } },
  high: { label: "Intense", icon: { name: "circle", color: staticColors.danger } },
};

/** Carte de séance d'entraînement — JSX extrait tel quel de planning.tsx
 * (cf. plan Phase 3 Étape 3), aucun changement de comportement. Extraite
 * pour être réutilisable depuis UnifiedEventCard (cf.
 * src/planning/components/UnifiedEventCard.tsx), qui délègue ici pour les
 * événements de type "séance". */
export function SessionCard({
  session,
  expanded,
  onPress,
  onToggleDone,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  session: TrainingSession;
  expanded: boolean;
  onPress: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const colors = useThemeColors();
  const { scale, onPressIn, onPressOut } = usePressScale();
  const meta = ACTIVITY_META[session.activityType];
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`${CARD} gap-3`}
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`h-11 w-11 items-center justify-center rounded-full ${
              session.completed ? "bg-success/15" : meta.chip
            }`}
          >
            <MaterialCommunityIcons
              name={session.completed ? "check" : meta.icon}
              size={20}
              color={session.completed ? colors.success : meta.tint}
            />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className={`text-base font-bold ${session.completed ? "text-muted line-through" : "text-text"}`}>
              {session.customActivityLabel || meta.label}
            </Text>
            <Text className="text-sm text-muted">
              {formatDate(session.date)} · {session.time || "Heure libre"}
              {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={expanded ? "chevron-up" : "chevron-right"}
            size={20}
            color={colors.textMuted}
          />
        </View>

        {expanded ? (
          <View className="gap-3 border-t border-border pt-3">
            {session.intensity ? (
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name={INTENSITY_META[session.intensity].icon.name} size={12} color={INTENSITY_META[session.intensity].icon.color} />
                <Text className="text-sm text-muted">Intensité : {INTENSITY_META[session.intensity].label}</Text>
              </View>
            ) : null}
            {session.notes.trim() ? <Text className="text-sm leading-5 text-text">{session.notes}</Text> : null}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={onToggleDone}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-card bg-primary p-3"
              >
                <Text className="text-sm font-bold text-on-primary">
                  {session.completed ? "Marquer à faire" : "Marquer faite"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onEdit}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-card border border-border p-3"
              >
                <Text className="text-sm font-semibold text-text">Modifier</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={onDuplicate}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card border border-border p-3"
              >
                <MaterialCommunityIcons name="content-copy" size={15} color={colors.textMuted} />
                <Text className="text-sm font-semibold text-text">Dupliquer +7j</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDelete}
                activeOpacity={0.8}
                className="items-center justify-center rounded-card border border-border px-4"
              >
                <Text className="text-sm font-semibold text-warning">Suppr.</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}
