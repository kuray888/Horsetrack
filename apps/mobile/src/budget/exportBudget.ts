import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { buildTextPdf } from "@/lib/pdfText";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { toCsv } from "@/export/dataExport";
import { buildBudgetReportLines, budgetCsvRows, type BudgetReportInput } from "@/budget/budgetReport";
import { t } from "@/i18n";

/**
 * Écrit le relevé de dépenses sur disque (PDF ou CSV) et ouvre le partage iOS.
 * Même construction que stable/exportMonthlyReport.ts : seuls les effets de
 * bord vivent ici, le contenu est dans budget/budgetReport.ts. Fichier dans le
 * cache : il se régénère en une seconde.
 */
export async function exportBudget(input: BudgetReportInput, format: "pdf" | "csv"): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t("Partage indisponible"), t("Le partage de fichiers n'est pas disponible sur cet appareil."));
      return false;
    }
    const safeName = input.horseName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "cheval";
    const file = new File(Paths.cache, t("Dépenses {year} - {safeName}.{ext}", { year: input.year, safeName, ext: format }));
    if (file.exists) file.delete();
    file.create();
    if (format === "pdf") {
      file.write(buildTextPdf(buildBudgetReportLines(input, new Date())));
      await runNativeInteraction(() => Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" }));
    } else {
      file.write(toCsv([t("Date"), t("Catégorie"), t("Montant"), t("Payée"), t("Notes")], budgetCsvRows(input)));
      await runNativeInteraction(() => Sharing.shareAsync(file.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" }));
    }
    return true;
  } catch (e) {
    if (__DEV__) console.warn("[budget] export échoué", e);
    Alert.alert(t("Export impossible"), t("Le relevé n'a pas pu être créé. Réessaie dans un instant."));
    return false;
  }
}
