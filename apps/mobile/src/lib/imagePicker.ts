import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";

/**
 * Ouvre la galerie, copie l'image choisie dans le stockage local persistant
 * de l'app (le cache renvoyé par le picker peut être nettoyé par l'OS), et
 * renvoie son URI locale. Renvoie null si l'utilisateur annule ou refuse
 * l'accès à la galerie.
 */
export async function pickAndPersistImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const source = new File(result.assets[0].uri);
  const dest = new File(Paths.document, `horse-${Date.now()}.jpg`);
  source.copy(dest);
  return dest.uri;
}
