import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { track } from "@/lib/analytics";
import { ACTIVITY_META } from "@/agenda/store";
import { APPT_META, DOC_META, EXPENSE_META, MOOD_META } from "@/agenda/meta";
import { DISCIPLINES, HORSE_LEVELS, HORSE_SEXES, RECOVERY_STATUSES, RIDER_GOALS } from "@/onboarding/options";
import { INTENSITY_META } from "@/sessions/components/SessionCard";
import { ROLE_LABEL } from "@/lib/sharing";
import { buildExportZip, exportFileName, type ExportData, type ExportLabels } from "@/export/dataExport";
import { t } from "@/i18n";

const fromMeta = (meta: Record<string, { label: string }>) =>
  Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.label]));
const fromOptions = (options: { value: string; label: string }[]) =>
  Object.fromEntries(options.map((o) => [o.value, o.label]));

/** Libellés affichés dans l'app, repris tels quels dans l'export : le fichier
 * dit « Vétérinaire » là où l'écran dit « Vétérinaire ». */
function exportLabels(): ExportLabels {
  return {
    activity: fromMeta(ACTIVITY_META),
    mood: fromMeta(MOOD_META),
    appointmentType: fromMeta(APPT_META),
    expenseCategory: fromMeta(EXPENSE_META),
    documentCategory: fromMeta(DOC_META),
    horseSex: fromOptions(HORSE_SEXES),
    horseLevel: fromOptions(HORSE_LEVELS),
    discipline: fromOptions(DISCIPLINES),
    intensity: fromMeta(INTENSITY_META),
    goalType: fromOptions(RIDER_GOALS),
    sharedRole: ROLE_LABEL,
    recoveryStatus: fromOptions(RECOVERY_STATUSES),
  };
}

/**
 * Écrit l'archive dans le cache puis ouvre le partage iOS/Android (Fichiers,
 * Mail, AirDrop…). Même schéma que horses/exportHealthRecord.ts : seuls les
 * effets de bord vivent ici, le contenu est construit par dataExport.ts.
 */
export async function exportAllData(data: ExportData): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t("Partage indisponible"), t("Le partage de fichiers n'est pas disponible sur cet appareil."));
      return;
    }
    const now = new Date();
    const file = new File(Paths.cache, exportFileName(now));
    if (file.exists) file.delete();
    file.create();
    file.write(buildExportZip(data, exportLabels(), now));
    track("data_exported", { horses: data.horses.length, sessions: data.sessions.length });
    await runNativeInteraction(() =>
      Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive" })
    );
  } catch (e) {
    console.warn("[export] échec", e);
    Alert.alert(t("Export impossible"), t("L'export n'a pas pu être créé. Réessaie dans un instant."));
  }
}
