import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { formatDate } from "@/lib/dateFormat";
import { ACTIVITY_META, type JournalEntry } from "@/agenda/store";
import { MOOD_META } from "@/agenda/meta";
import { animateNextLayout } from "@/lib/motion";
import { STATUS_COLORS } from "@/theme/palettes";
import { t } from "@/i18n";
import { JournalVideo } from "@/agenda/components/JournalVideo";
import { CommentsButton } from "@/community/components/CommentsButton";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export function JournalCard({
  entry,
  expanded,
  onToggleExpand,
  onDelete,
  onEdit,
}: {
  entry: JournalEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const meta = ACTIVITY_META[entry.activityType];
  const mood = MOOD_META[entry.mood];
  // Un souvenir se reconnaît d'abord à sa photo : elle est visible carte
  // fermée, comme dans un carnet. La météo et le ressenti ne s'affichent
  // qu'une fois (ils étaient répétés dans l'en-tête puis dans le corps).
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        animateNextLayout();
        onToggleExpand();
      }}
      accessibilityRole="button"
      accessible={!expanded}
      accessibilityLabel={t("{label}, {formatDate}, ressenti {label2}{v}", { label: meta.label, formatDate: formatDate(entry.date), label2: mood.label, v: entry.notes ? `. ${entry.notes}` : "" })}
      accessibilityState={{ expanded }}
      accessibilityActions={[
        { name: "activate", label: expanded ? t("Replier") : t("Déplier") },
        { name: "edit", label: t("Modifier") },
        { name: "delete", label: t("Supprimer") },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "activate") {
          animateNextLayout();
          onToggleExpand();
        } else if (e.nativeEvent.actionName === "edit") onEdit();
        else if (e.nativeEvent.actionName === "delete") onDelete();
      }}
      className={`${CARD} gap-3`}
    >
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={meta.tint} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{meta.label}</Text>
          <Text className="text-sm text-muted">
            {formatDate(entry.date)} · {entry.time}
            {entry.weather ? t(" · {icon} {v}°C", { icon: entry.weather.icon, v: Math.round(entry.weather.tempC) }) : ""}
          </Text>
        </View>
        <Text className="text-2xl" accessibilityLabel={t("Ressenti : {label}", { label: mood.label })}>
          {mood.emoji}
        </Text>
      </View>

      {entry.photoUri ? (
        <Image
          source={{ uri: entry.photoUri }}
          style={{ width: "100%", height: 200, borderRadius: 16 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {entry.videoUri ? (
        expanded ? (
          <JournalVideo uri={entry.videoUri} height={220} />
        ) : (
          <View className="flex-row items-center gap-1.5">
            <MaterialCommunityIcons name="play-circle" size={16} color={meta.tint} />
            <Text className="text-sm font-semibold text-muted">{t("Vidéo")}</Text>
          </View>
        )
      ) : null}

      {entry.notes ? (
        <Text className="text-[15px] leading-5 text-text" numberOfLines={expanded ? undefined : 2}>
          {entry.notes}
        </Text>
      ) : null}

      {expanded ? (
        <View className="gap-3 border-t border-border pt-3">
          <Text className="text-sm text-muted">
            {t("Ressenti : ")}{mood.label}
            {entry.weather ? ` · ${entry.weather.label}` : ""}
          </Text>
          <CommentsButton horseId={entry.horseId} targetType="journal" targetId={entry.id} />
          <View className="flex-row gap-2">
            <TouchableOpacity accessibilityRole="button"
              onPress={onEdit}
              activeOpacity={0.8}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card border border-border p-3"
            >
              <MaterialCommunityIcons name="pencil-outline" size={15} color={meta.tint} />
              <Text className="text-sm font-semibold text-text">{t("Modifier")}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              onPress={onDelete}
              activeOpacity={0.8}
              accessibilityLabel={t("Supprimer ce souvenir")}
              className="flex-row items-center justify-center gap-1.5 rounded-card border border-border px-4"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={15} color={STATUS_COLORS.danger} />
              <Text className="text-sm font-semibold text-danger">{t("Supprimer")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
