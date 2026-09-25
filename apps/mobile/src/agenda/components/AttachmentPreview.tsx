import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "@/components/AppImage";
import { colors } from "@/theme/colors";

/** Vrai pour un PDF, qu'il soit local ("…/document-123.pdf") ou une URL signée
 * du stockage ("…/<id>.pdf?token=…") — d'où le retrait de la query string :
 * son "?token=" final empêcherait un simple `.endsWith(".pdf")`. */
export function isPdfUri(uri: string | null | undefined): boolean {
  return !!uri && uri.split("?")[0].toLowerCase().endsWith(".pdf");
}

/** Aperçu d'une pièce jointe dans un formulaire. <Image> ne sait pas décoder
 * un PDF (il resterait un cadre vide, cf. DocumentCard), on affiche donc une
 * pastille explicite. `contain` plutôt que `cover` : un document doit se voir
 * en entier, pas rogné. */
export function AttachmentPreview({ uri, height = 160 }: { uri: string; height?: number }) {
  if (isPdfUri(uri)) {
    return (
      <View style={{ height }} className="items-center justify-center gap-1 rounded-card border border-border bg-highlight">
        <MaterialCommunityIcons name="file-pdf-box" size={34} color={colors.danger} />
        <Text className="text-sm font-semibold text-text">Document PDF joint</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height, borderRadius: 20 }}
      contentFit="contain"
    />
  );
}
