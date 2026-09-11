import { Alert, Linking, Text, TouchableOpacity, View } from "react-native";
import * as Sharing from "expo-sharing";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "@/components/AppImage";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import { Locked } from "@/components/Locked";
import type { Doc } from "@/agenda/store";
import { DOC_META } from "@/agenda/meta";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Un PDF ne peut pas être décodé par <Image> (cf. audit pré-publication :
 * écran vide à l'ouverture) — détecté via filePath (chemin Storage brut,
 * une fois synchronisé) ou fileUri (fichier local pas encore synchronisé,
 * cf. lib/imagePicker.ts pickAndPersistDocumentFile). Pas via l'URL signée
 * elle-même : son "?token=..." final empêcherait un simple `.endsWith`. */
function isPdfDoc(doc: Doc): boolean {
  return (doc.filePath ?? doc.fileUri ?? "").toLowerCase().endsWith(".pdf");
}

/** Ouvre le PDF dans le lecteur natif — Quick Look (iOS) / equivalent Android
 * pour un fichier local pas encore synchronisé, Safari/Chrome pour une URL
 * signée distante (déjà consultable telle quelle, pas besoin de la
 * retélécharger). */
async function openPdf(fileUri: string) {
  if (fileUri.startsWith("file://")) {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" });
    } else {
      Alert.alert("Impossible d'ouvrir", "Aucune application disponible pour afficher ce document.");
    }
    return;
  }
  await Linking.openURL(fileUri);
}

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
          {doc.fileUri && isPdfDoc(doc) ? (
            <TouchableOpacity
              onPress={() => openPdf(doc.fileUri!)}
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 rounded-card border border-border p-4"
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.danger} />
              <Text className="text-sm font-semibold text-accent">Consulter le PDF</Text>
            </TouchableOpacity>
          ) : doc.fileUri ? (
            <Image
              source={{ uri: doc.fileUri }}
              style={{ width: "100%", height: 160, borderRadius: 20 }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="paperclip" size={15} color={colors.textMuted} />
              <Text className="text-sm text-muted">Aucun fichier joint</Text>
            </View>
          )}
          {/* Modifier/supprimer un document existant est écrit côté serveur (RLS
              documents_update_own/delete_own) sous la même condition Premium que
              la création (cf. DocumentForm) — sans ce verrou, un essai expiré
              voyait son "Modifier"/"Supprimer" mettre à jour l'affichage local
              en silence pendant que le serveur rejetait l'écriture, cf. audit
              pré-publication. */}
          <Locked message="Modifier ou supprimer un document réservé à l'abonnement Premium">
            <View className="mt-1 flex-row items-center gap-4">
              <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-accent">Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-danger">Supprimer ce document</Text>
              </TouchableOpacity>
            </View>
          </Locked>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
