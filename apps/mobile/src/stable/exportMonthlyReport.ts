import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { buildTextPdf } from "@/lib/pdfText";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { buildMonthlyReportLines, type MonthlyReportInput } from "@/stable/monthlyReport";
import { t } from "@/i18n";

/**
 * Écrit le rapport du mois sur disque et ouvre le partage iOS (mail,
 * Fichiers, impression). Même construction que horses/exportHealthRecord.ts :
 * seuls les effets de bord vivent ici, le contenu est dans monthlyReport.ts.
 * Fichier dans le cache : il se régénère en une seconde.
 */
export async function exportMonthlyReport(input: MonthlyReportInput): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t("Partage indisponible"), t("Le partage de fichiers n'est pas disponible sur cet appareil."));
      return false;
    }
    const pdf = buildTextPdf(buildMonthlyReportLines(input, new Date()));
    const safeName = input.horseName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "cheval";
    const month = `${input.month.getFullYear()}-${String(input.month.getMonth() + 1).padStart(2, "0")}`;
    const file = new File(Paths.cache, t("Rapport {month} - {safeName}.pdf", { month, safeName }));
    if (file.exists) file.delete();
    file.create();
    file.write(pdf);
    await runNativeInteraction(() => Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" }));
    return true;
  } catch (e) {
    console.warn("[monthlyReport] export échoué", e);
    Alert.alert(t("Export impossible"), t("Le rapport n'a pas pu être créé. Réessaie dans un instant."));
    return false;
  }
}
