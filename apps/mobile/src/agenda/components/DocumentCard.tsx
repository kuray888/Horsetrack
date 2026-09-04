import { Image, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import type { Doc } from "@/agenda/store";
import { DOC_META } from "@/agenda/meta";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export function DocumentCard({
  doc,
  expanded,
  onToggleExpand,
  onDelete,
  onEdit,
}: {
  doc: Doc;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const meta = DOC_META[doc.category];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{doc.name}</Text>
          <Text className="text-sm text-muted">{formatDate(doc.date)}</Text>
        </View>
        <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {doc.fileUri ? (
            <Image source={{ uri: doc.fileUri }} className="h-40 w-full rounded-card" resizeMode="cover" />
          ) : (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="paperclip" size={15} color={colors.textMuted} />
              <Text className="text-sm text-muted">Aucun fichier joint</Text>
            </View>
          )}
          <View className="mt-1 flex-row items-center gap-4">
            <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-accent">Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-danger">Supprimer ce document</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
