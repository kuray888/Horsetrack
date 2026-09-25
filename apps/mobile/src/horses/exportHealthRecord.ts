import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { buildTextPdf } from "@/lib/pdfText";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { recordPositiveMoment } from "@/lib/reviewPrompt";
import { buildHealthRecordLines, type RecordAppointment, type RecordHorse, type RecordWeight } from "@/horses/healthRecord";

/**
 * Écrit le carnet de santé sur disque et ouvre le partage iOS — d'où on peut
 * l'envoyer au vétérinaire, l'enregistrer dans Fichiers ou l'imprimer.
 *
 * Séparé de `buildHealthRecordLines` (ce qui figure au carnet) et de
 * `buildTextPdf` (comment c'est mis en page) : seuls les effets de bord
 * vivent ici, c'est ce qui laisse les deux autres testables sans fichier.
 *
 * Le fichier part dans le CACHE et non dans Documents : il se régénère en une
 * seconde à partir de données qui vivent ailleurs, et n'a aucune raison
 * d'occuper durablement l'espace de l'appareil — contrairement aux photos du
 * coffre-fort (cf. lib/imagePicker.ts, qui écrit dans Documents).
 */
export async function exportHealthRecord(
  horse: RecordHorse,
  soins: RecordAppointment[],
  weights: RecordWeight[]
): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Partage indisponible", "Le partage de fichiers n'est pas disponible sur cet appareil.");
      return;
    }
    const lines = buildHealthRecordLines(horse, soins, weights, new Date());
    const pdf = buildTextPdf(lines);
    // Nom de fichier lisible par le destinataire : c'est lui qui s'affichera
    // dans la pièce jointe d'un mail au véto.
    const safeName = horse.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "cheval";
    const file = new File(Paths.cache, `Carnet de sante - ${safeName}.pdf`);
    if (file.exists) file.delete();
    file.create();
    file.write(pdf);
    // `runNativeInteraction` : la feuille de partage est une activité Android
    // distincte, qui rejouerait sinon le verrou biométrique au retour
    // (cf. lib/nativeInteraction.ts). Sans effet sur iOS.
    await runNativeInteraction(() =>
      Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" })
    );
    recordPositiveMoment("pdf_exported");
  } catch (e) {
    console.warn("[healthRecord] export échoué", e);
    Alert.alert("Export impossible", "Le carnet n'a pas pu être créé. Réessaie dans un instant.");
  }
}
