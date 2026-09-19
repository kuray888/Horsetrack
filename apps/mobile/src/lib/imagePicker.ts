import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { buildPdf, parseImageForPdf, sniffImageKind, type PdfPageImage } from "@/lib/pdfBuilder";

/** Demande l'accès à la photothèque ; explique comment le rétablir si
 * l'utilisateur l'a refusé définitivement. Renvoie false si l'accès manque. */
async function ensurePhotoLibraryAccess(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === "granted") return true;
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
  return false;
}

/**
 * Ouvre la galerie, copie l'image choisie dans le stockage local persistant
 * de l'app (le cache renvoyé par le picker peut être nettoyé par l'OS), et
 * renvoie son URI locale. Renvoie null si l'utilisateur annule ou refuse
 * l'accès à la galerie.
 *
 * `crop` (défaut true) : recadrage carré, voulu pour une photo de cheval ou
 * du journal (affichée en pastille/bandeau). À désactiver pour tout ce qui
 * doit rester lisible en entier — un reçu ou un document forcé dans un carré
 * perd ses bords (cf. audit du 2026-09-19 : impossible de garder un compte
 * rendu A4 complet). Sans recadrage, le picker iOS rend par défaut la photo
 * dans son format d'origine (HEIC brut, que ni le navigateur ni Android ne
 * lisent) : on demande donc la représentation "compatible" (JPEG).
 *
 * Le redimensionnement 1080px (via expo-image-manipulator) a été retiré le
 * 2026-09-05 : il provoquait un crash natif au lancement en build TestFlight
 * (DYLD Symbol missing, ExpoImageManipulator.framework vs ExpoModulesCore.framework
 * — décalage ABI natif malgré des versions SDK 57.0.x cohérentes dans le
 * lockfile, donc pas un simple problème de version à épingler). Priorité :
 * app qui démarre > optimisation image. Seule la compression qualité (déjà
 * présente avant cet essai) subsiste.
 */
export async function pickAndPersistImage(options: { crop?: boolean } = {}): Promise<string | null> {
  const crop = options.crop ?? true;
  try {
    if (!(await ensurePhotoLibraryAccess())) return null;

    const result = await ImagePicker.launchImageLibraryAsync(
      crop
        ? { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 }
        : {
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.7,
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          }
    );
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

/** Nombre maximum de pages regroupées dans un même document. */
export const MAX_DOCUMENT_PAGES = 20;
/** Au-delà, l'envoi vers le stockage risque d'échouer (limite serveur 50 Mo)
 * et de laisser le document uniquement en local sans que l'utilisateur le sache. */
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export type DocumentSource = "photos" | "file";

function documentExtension(uri: string, mimeType?: string | null): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  const fromUri = uri.split("?")[0].split(".").pop()?.toLowerCase();
  return fromUri && /^[a-z0-9]{2,5}$/.test(fromUri) ? fromUri : "jpg";
}

function persistDocumentCopy(sourceUri: string, ext: string): string | null {
  const dest = new File(Paths.document, `document-${Date.now()}.${ext}`);
  try {
    new File(sourceUri).copy(dest);
  } catch {
    return null;
  }
  return dest.uri;
}

/** Photos du coffre-fort : une seule photo est conservée telle quelle ; plusieurs
 * (compte rendu de plusieurs pages) sont regroupées dans UN PDF, dans l'ordre
 * de sélection — un document n'a qu'un fichier (cf. Doc.fileUri), et un PDF
 * multi-pages est déjà géré partout (synchro, "Consulter le PDF"). */
async function pickDocumentPhotos(): Promise<string | null> {
  if (!(await ensurePhotoLibraryAccess())) return null;

  // Pas de recadrage (les documents doivent rester entiers) et représentation
  // "compatible" : sans elle le picker iOS livre les photos iPhone en HEIC
  // brut, que ni le PDF ni le stockage ne savent traiter.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: MAX_DOCUMENT_PAGES,
    orderedSelection: true,
    quality: 0.7,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled || result.assets.length === 0) return null;

  if (result.assets.length === 1) {
    const asset = result.assets[0];
    // Extension d'après le contenu réel : le nom ou le mimeType donné par le
    // picker ne sont pas fiables (JPEG livré sous un nom ".heic"), et
    // l'extension décide du Content-Type à l'envoi (cf. cloudSync.ts
    // documentContentType).
    const kind = sniffImageKind(await new File(asset.uri).bytes());
    return persistDocumentCopy(asset.uri, kind === "jpeg" ? "jpg" : kind === "png" ? "png" : documentExtension(asset.uri, asset.mimeType));
  }

  const pages: PdfPageImage[] = [];
  let unsupported = 0;
  for (const asset of result.assets) {
    const page = parseImageForPdf(await new File(asset.uri).bytes());
    if (page) pages.push(page);
    else unsupported++;
  }
  // Jamais de page perdue en silence : un compte rendu incomplet sans le
  // savoir est pire qu'un refus explicite.
  if (unsupported > 0) {
    Alert.alert(
      "Certaines images ne peuvent pas être regroupées",
      `${unsupported} image${unsupported > 1 ? "s" : ""} sur ${result.assets.length} ${
        unsupported > 1 ? "sont" : "est"
      } dans un format non pris en charge (capture d'écran avec transparence, par exemple). Choisis plutôt des photos, ou joins un fichier PDF.`
    );
    return null;
  }

  const dest = new File(Paths.document, `document-${Date.now()}.pdf`);
  dest.write(buildPdf(pages));
  return dest.uri;
}

/** Fichier depuis l'app Fichiers / iCloud Drive / une pièce jointe enregistrée :
 * PDF, JPEG ou PNG uniquement (les seuls types que le stockage et
 * l'affichage savent traiter, cf. lib/cloudSync.ts documentContentType). */
async function pickDocumentFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (asset.size != null && asset.size > MAX_DOCUMENT_BYTES) {
    Alert.alert("Fichier trop volumineux", "Ce fichier dépasse 25 Mo. Choisis-en un plus léger.");
    return null;
  }
  return persistDocumentCopy(asset.uri, documentExtension(asset.name ?? asset.uri, asset.mimeType));
}

/**
 * Pièce jointe d'un document du coffre-fort (cf. agenda/hooks/useDocumentForm.ts) :
 * renvoie l'URI locale persistée (.jpg / .png / .pdf), ou null si l'utilisateur
 * annule ou si l'opération échoue — les échecs sont déjà signalés par une
 * alerte, l'appelant n'a rien à afficher. Distinct de pickAndPersistImage : un
 * document peut être un PDF ou regrouper plusieurs pages, et ne doit jamais
 * être recadré.
 */
export async function pickAndPersistDocument(source: DocumentSource): Promise<string | null> {
  try {
    return source === "photos" ? await pickDocumentPhotos() : await pickDocumentFile();
  } catch {
    Alert.alert("Impossible d'ajouter ce document", "Une erreur est survenue. Réessaie, ou choisis un autre fichier.");
    return null;
  }
}

/**
 * Demande à l'utilisateur d'où vient le document (Photos ou Fichier) puis le
 * récupère — point d'entrée unique pour tout ce qui rejoint le coffre-fort
 * (formulaire de document, facture d'une dépense). Renvoie null si
 * l'utilisateur annule, à n'importe quelle étape.
 *
 * Trois boutons exactement : c'est le maximum qu'Android accepte dans une
 * alerte native.
 */
export function chooseAndPickDocument(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Joindre un document",
      "D'où vient-il ?",
      [
        { text: "Photos (plusieurs pages possibles)", onPress: () => pickAndPersistDocument("photos").then(resolve) },
        { text: "Fichier PDF ou image", onPress: () => pickAndPersistDocument("file").then(resolve) },
        { text: "Annuler", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}
