import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Résolution max (largeur/hauteur, image déjà carrée après le crop du
 * picker) — largement suffisante pour l'affichage mobile (bannière cheval,
 * cartes Journal/Document/Expense), cf. audit technique post-V1 : les photos
 * n'étaient jusque-là que compressées en qualité JPEG (`quality: 0.7`
 * ci-dessous), jamais redimensionnées, ce qui pouvait décoder en mémoire une
 * image à pleine résolution capteur (ex: 4000×4000) pour un affichage bien
 * plus petit à l'écran. Jamais appliqué à la hausse (cf. plus bas) : une
 * photo déjà plus petite n'est pas dégradée inutilement.
 */
const MAX_DIMENSION = 1080;

/**
 * Ouvre la galerie, redimensionne si l'image dépasse MAX_DIMENSION, copie le
 * résultat dans le stockage local persistant de l'app (le cache renvoyé par
 * le picker peut être nettoyé par l'OS), et renvoie son URI locale. Renvoie
 * null si l'utilisateur annule ou refuse l'accès à la galerie.
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

  const asset = result.assets[0];
  let sourceUri = asset.uri;

  if (asset.width > MAX_DIMENSION || asset.height > MAX_DIMENSION) {
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize({ width: MAX_DIMENSION });
      const rendered = await context.renderAsync();
      // Compression un peu plus légère qu'à la capture (0.8 vs 0.7) : la
      // réduction de dimensions fait déjà l'essentiel du gain de poids,
      // recompresser fort une deuxième fois ajouterait des artefacts JPEG
      // sans bénéfice notable.
      const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
      sourceUri = saved.uri;
    } catch {
      // Redimensionnement best-effort : en cas d'échec, on persiste quand
      // même l'image d'origine plutôt que de bloquer l'ajout de la photo.
    }
  }

  const source = new File(sourceUri);
  const dest = new File(Paths.document, `horse-${Date.now()}.jpg`);
  try {
    source.copy(dest);
  } catch {
    return null;
  }
  return dest.uri;
}
