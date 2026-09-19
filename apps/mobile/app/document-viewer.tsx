import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "@/components/AppImage";

/** Visionneuse plein écran d'une photo de document (cf. DocumentCard, « Toucher
 * pour ouvrir en grand »).
 *
 * Écrit en JS pur, sans module natif : le bouton ouvrait auparavant la feuille
 * de partage iOS (`Sharing.shareAsync`), qui propose d'enregistrer ou de
 * partager le fichier au lieu de l'afficher. Un vrai lecteur n'existe pas
 * côté natif sans ajouter de dépendance ; pour une PHOTO, un ScrollView
 * zoomable suffit.
 *
 * Zoom : `maximumZoomScale` est natif iOS (pincer, double-glisser). Android
 * ignore cette propriété — la photo s'y affiche en grand, `contain`, mais sans
 * pincer pour zoomer.
 *
 * Route dédiée en `fullScreenModal` (cf. _layout.tsx) plutôt que `<Modal>` :
 * le repo évite le Modal natif de RN, qui peut rester accroché sans s'afficher
 * sous Expo Go avec la New Architecture (cf. PickerOverlay.tsx). */
export default function DocumentViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <View className="flex-1 bg-black">
      {uri ? (
        <ScrollView
          maximumZoomScale={5}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width, height, justifyContent: "center" }}
        >
          <Image
            source={{ uri }}
            style={{ width, height: height - insets.top - insets.bottom }}
            contentFit="contain"
            accessibilityLabel={title ?? "Document"}
          />
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-white">Document introuvable.</Text>
        </View>
      )}

      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16 }}
        className="flex-row items-center justify-between gap-3"
      >
        <Text numberOfLines={1} className="flex-1 text-base font-semibold text-white">
          {title ?? ""}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
        >
          <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" accessibilityElementsHidden />
        </TouchableOpacity>
      </View>
    </View>
  );
}
