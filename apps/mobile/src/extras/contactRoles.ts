import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { t } from "@/i18n";
import type { ContactRole } from "@/extras/model";

export const CONTACT_ROLES: { value: ContactRole; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: "veto", label: t("Vétérinaire"), icon: "stethoscope" },
  { value: "marechal", label: t("Maréchal-ferrant"), icon: "horseshoe" },
  { value: "osteo", label: t("Ostéopathe"), icon: "hand-heart-outline" },
  { value: "dentiste", label: t("Dentiste équin"), icon: "tooth-outline" },
  { value: "coach", label: t("Coach"), icon: "whistle-outline" },
  { value: "pension", label: t("Pension / écurie"), icon: "barn" },
  { value: "autre", label: t("Autre"), icon: "account-outline" },
];

export function roleMeta(role: ContactRole) {
  return CONTACT_ROLES.find((r) => r.value === role) ?? CONTACT_ROLES[CONTACT_ROLES.length - 1];
}
