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
  try {
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
  } catch {
    // Best-effort : cf. audit crash SecureStore/modules natifs du 2026-09-08.
    return null;
  }
}

/**
 * Reconstruit une URI locale persistée (Horse.photoUrl, Doc.fileUri,
 * JournalEntry.photoUri...) contre le dossier documents ACTUEL plutôt que de
 * réutiliser telle quelle la chaîne sauvegardée en SecureStore. iOS attribue
 * un nouveau conteneur (donc un nouveau chemin absolu file:///.../Documents/)
 * à chaque mise à jour ou réinstallation de l'app, même si le contenu du
 * dossier Documents lui-même est conservé — l'ancienne URI absolue ne
 * pointait donc plus vers rien après coup ("la photo disparaît après un
 * moment", cf. audit du 2026-09-09), alors que le fichier existait toujours
 * sous le même nom. Ne touche pas les URL distantes (http/https, cf.
 * lib/cloudSync.ts createSignedUrl) : seules les URI `file://` sont concernées.
 */
export function resolveLocalFileUri(uri: string | null): string | null {
  if (!uri || !uri.startsWith("file://")) return uri;
  const filename = uri.split("/").pop();
  if (!filename) return uri;
  return new File(Paths.document, filename).uri;
}

/** Variante pour les documents du coffre-fort (cf. agenda/hooks/useDocumentForm.ts)
 * : contrairement à pickAndPersistImage (photos de cheval/reçus, toujours de
 * vraies images), un document peut être un PDF — notamment un PDF scanné
 * depuis l'app Notes/Fichiers puis enregistré dans la pellicule, que le
 * picker Photos laisse sélectionner même en ne demandant que des "images".
 * Avant, le fichier était systématiquement recopié en ".jpg" quel que soit
 * son contenu réel, cassant l'affichage des PDF (cf. audit pré-publication :
 * un lecteur d'image ne peut pas décoder des octets PDF, quelle que soit
 * l'extension). Ici, l'extension réelle (déduite du mimeType renvoyé par le
 * picker, ou à défaut de l'URI source) est préservée. N'affecte que le
 * coffre-fort — pickAndPersistImage reste inchangée pour les autres usages. */
export async function pickAndPersistDocumentFile(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const extFromMime = asset.mimeType === "application/pdf" ? "pdf" : null;
  const extFromUri = asset.uri.split(".").pop()?.toLowerCase();
  const ext = extFromMime ?? (extFromUri && /^[a-z0-9]{2,5}$/.test(extFromUri) ? extFromUri : "jpg");

  const source = new File(asset.uri);
  const dest = new File(Paths.document, `document-${Date.now()}.${ext}`);
  try {
    source.copy(dest);
  } catch {
    return null;
  }
  return dest.uri;
}
