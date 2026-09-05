import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";

/**
 * Ouvre la galerie, copie l'image choisie dans le stockage local persistant
 * de l'app (le cache renvoyé par le picker peut être nettoyé par l'OS), et
 * renvoie son URI locale. Renvoie null si l'utilisateur annule ou refuse
 * l'accès à la galerie.
 *
 * Le redimensionnement 1080px (via expo-image-manipulator) a été retiré le
 * 2026-09-05 : il provoquait un crash natif au lancement en build TestFlight
 * (DYLD Symbol missing, ExpoImageManipulator.framework vs ExpoModulesCore.framework
 * — décalage ABI natif malgré des versions SDK 57.0.x cohérentes dans le
 * lockfile, donc pas un simple problème de version à épingler). Priorité :
 * app qui démarre > optimisation image. Seule la compression qualité (déjà
 * présente avant cet essai) subsiste.
 */
export async function pickAndPersistImage(): Promise<string | null> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    // Sur iOS/Android, une fois l'accès refusé une première fois, l'OS ne
    // réaffiche plus jamais sa propre demande (canAskAgain devient false) —
    // sans ce message, retaper sur "Ajouter une photo" ne ferait plus jamais
    // rien du tout, silencieusement, comme si le bouton était cassé (cf.
    // audit technique pré-V1 §6).
    if (!canAskAgain) {
      Alert.alert(
        "Accès aux photos refusé",
        "Autorise Horsetrack à accéder à tes photos dans les réglages de ton téléphone pour ajouter une image.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir les réglages", onPress: () => Linking.openSettings() },
        ]
      );
    }
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const source = new File(result.assets[0].uri);
  const dest = new File(Paths.document, `horse-${Date.now()}.jpg`);
  try {
    source.copy(dest);
  } catch {
    return null;
  }
  return dest.uri;
}
