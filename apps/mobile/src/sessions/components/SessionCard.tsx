import { useMemo } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { colors as staticColors } from "@/theme/colors";
import { usePressScale } from "@/hooks/usePressScale";
import { formatDate } from "@/lib/dateFormat";
import { ACTIVITY_META } from "@/agenda/store";
import type { IconSpec } from "@/components/FormChips";
import type { SessionIntensity, TrainingSession } from "@/sessions/store";
import type { SessionRide } from "@/rides/types";
import { decodePolyline, formatDistance, formatSpeed } from "@/rides/rideMath";
import { GaitBreakdown } from "@/rides/components/GaitBreakdown";
import { RouteTrace } from "@/rides/components/RouteTrace";
import { t } from "@/i18n";
import { CommentsButton } from "@/community/components/CommentsButton";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export const INTENSITY_META: Record<SessionIntensity, { label: string; icon: IconSpec }> = {
  low: { label: t("Légère"), icon: { name: "circle", color: staticColors.success } },
  medium: { label: t("Modérée"), icon: { name: "circle", color: staticColors.warning } },
  high: { label: t("Intense"), icon: { name: "circle", color: staticColors.danger } },
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
        accessibilityRole="button"
        // Carte repliée : un seul élément pour VoiceOver, avec ses actions
        // dans le rotor (la case à cocher et le balayage n'y sont pas
        // atteignables autrement). Dépliée : chaque bouton redevient
        // accessible séparément.
        accessible={!expanded}
        accessibilityLabel={`${session.customActivityLabel || meta.label}, ${formatDate(session.date)}, ${
          session.time || t("heure libre")
        }${session.completed ? t(", faite") : ""}`}
        accessibilityState={{ expanded }}
        accessibilityActions={[
          { name: "activate", label: expanded ? t("Replier") : t("Déplier") },
          { name: "toggleDone", label: session.completed ? t("Marquer à faire") : t("Marquer faite") },
          { name: "edit", label: t("Modifier") },
          { name: "delete", label: t("Supprimer") },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "activate") onPress();
          else if (e.nativeEvent.actionName === "toggleDone") onToggleDone();
          else if (e.nativeEvent.actionName === "edit") onEdit();
          else if (e.nativeEvent.actionName === "delete") onDelete();
        }}
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`${CARD} gap-3`}
      >
        <View className="flex-row items-center gap-3">
          {/* Le type d'activité reste lisible une fois la séance faite :
              la coche verte vit désormais dans la case à droite. */}
          <View
            className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip} ${
              session.completed ? "opacity-50" : ""
            }`}
          >
            <MaterialCommunityIcons name={meta.icon} size={20} color={meta.tint} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className={`text-base font-bold ${session.completed ? "text-muted line-through" : "text-text"}`}>
              {session.customActivityLabel || meta.label}
            </Text>
            <Text className="text-sm text-muted">
              {formatDate(session.date)} · {session.time || t("Heure libre")}
              {session.durationMinutes ? t(" · {durationMinutes} min", { durationMinutes: session.durationMinutes }) : ""}
            </Text>
            {session.ride?.gps ? (
              <View className="flex-row items-center gap-1">
                <MaterialCommunityIcons name="map-marker-path" size={13} color={colors.accent} />
                <Text className="text-xs font-semibold text-accent">
                  {formatDistance(session.ride.distanceMeters)} · {formatSpeed(session.ride.avgSpeedKmh)} {t(" en moyenne")}
                </Text>
              </View>
            ) : null}
          </View>
          {/* Case à cocher directement sur la carte : marquer une séance
              faite demandait de la déplier puis de toucher « Marquer
              faite ». Le reste de la carte la déplie toujours. */}
          <TouchableOpacity
            onPress={onToggleDone}
            hitSlop={12}
            activeOpacity={0.6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: session.completed }}
            accessibilityLabel={session.completed ? t("Séance faite, marquer à faire") : t("Marquer la séance faite")}
            className={`h-7 w-7 items-center justify-center rounded-full ${
              session.completed ? "bg-success" : "border-2 border-border"
            }`}
          >
            {session.completed ? <MaterialCommunityIcons name="check" size={17} color="#ffffff" /> : null}
          </TouchableOpacity>
        </View>

        {expanded ? (
          <View className="gap-3 border-t border-border pt-3">
            {session.intensity ? (
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name={INTENSITY_META[session.intensity].icon.name} size={12} color={INTENSITY_META[session.intensity].icon.color} />
                <Text className="text-sm text-muted">{t("Intensité : ")}{INTENSITY_META[session.intensity].label}</Text>
              </View>
            ) : null}
            {session.notes.trim() ? <Text className="text-sm leading-5 text-text">{session.notes}</Text> : null}
            {session.ride?.gps ? <RideDetails ride={session.ride} /> : null}
            <CommentsButton horseId={session.horseId} targetType="session" targetId={session.id} />
            {!session.completed ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/ride", params: { sessionId: session.id } })}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-1.5 rounded-card border border-primary/30 p-3"
              >
                <MaterialCommunityIcons name="play-circle-outline" size={16} color={colors.primary} />
                <Text className="text-sm font-bold text-primary">{t("Démarrer en direct")}</Text>
              </TouchableOpacity>
            ) : null}
            <View className="flex-row gap-2">
              <TouchableOpacity accessibilityRole="button"
                onPress={onToggleDone}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-card bg-primary p-3"
              >
                <Text className="text-sm font-bold text-on-primary">
                  {session.completed ? t("Marquer à faire") : t("Marquer faite")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                onPress={onEdit}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-card border border-border p-3"
              >
                <Text className="text-sm font-semibold text-text">{t("Modifier")}</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity accessibilityRole="button"
                onPress={onDuplicate}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card border border-border p-3"
              >
                <MaterialCommunityIcons name="content-copy" size={15} color={colors.textMuted} />
                <Text className="text-sm font-semibold text-text">{t("Dupliquer +7j")}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                onPress={onDelete}
                activeOpacity={0.8}
                className="items-center justify-center rounded-card border border-border px-4"
              >
                <Text className="text-sm font-semibold text-warning">{t("Suppr.")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Allures et tracé d'une séance enregistrée en direct (cf. rides/). */
function RideDetails({ ride }: { ride: SessionRide }) {
  const route = useMemo(() => (ride.route ? decodePolyline(ride.route) : []), [ride.route]);
  return (
    <View className="gap-3">
      <GaitBreakdown
        seconds={{ walk: ride.walkSeconds, trot: ride.trotSeconds, canter: ride.canterSeconds, halt: ride.haltSeconds }}
      />
      {route.length > 1 ? <RouteTrace coords={route} height={140} /> : null}
    </View>
  );
}
