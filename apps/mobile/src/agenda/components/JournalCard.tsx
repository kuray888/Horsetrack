import { Image, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDate } from "@/lib/dateFormat";
import { ACTIVITY_META, type JournalEntry } from "@/agenda/store";
import { MOOD_META } from "@/agenda/meta";

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
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={meta.tint} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{meta.label}</Text>
          <Text className="text-sm text-muted">
            {formatDate(entry.date)} · {entry.time}
            {entry.weather ? ` · ${entry.weather.icon} ${Math.round(entry.weather.tempC)}°C` : ""}
          </Text>
        </View>
        <Text className="text-lg">{mood.emoji}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {entry.photoUri ? (
            <Image source={{ uri: entry.photoUri }} className="h-48 w-full rounded-card" resizeMode="cover" />
          ) : null}
          <Text className="text-sm text-text">{mood.emoji} Ressenti : {mood.label}</Text>
          {entry.weather ? (
            <Text className="text-sm text-text">
              {entry.weather.icon} {entry.weather.label} · {Math.round(entry.weather.tempC)}°C
            </Text>
          ) : null}
          {entry.notes ? <Text className="text-sm text-muted">{entry.notes}</Text> : null}
          <View className="mt-1 flex-row items-center gap-4">
            <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-accent">Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-danger">Supprimer cette entrée</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
