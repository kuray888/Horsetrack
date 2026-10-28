import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { ACTIVITY_META } from "@/agenda/store";
import { APPT_META } from "@/agenda/meta";
import type { UnifiedEvent } from "@/planning/unifiedEvents";
import { t } from "@/i18n";

/** Icône/couleur/titre d'un événement unifié pour les cartes de l'Accueil —
 * dérivés d'ACTIVITY_META/APPT_META (déjà la source de vérité utilisée par
 * Planning et le Horse Hub), pas d'une table de correspondance locale
 * dupliquée comme avant (cf. plan Phase 3 Étape 4). */
export function upcomingEventMeta(event: UnifiedEvent): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  chip: string;
  tint: string;
  tag: string;
  label: string;
  title: string;
} {
  if (event.kind === "session") {
    const meta = ACTIVITY_META[event.session.activityType];
    return {
      icon: meta.icon,
      chip: meta.chip,
      tint: meta.tint,
      tag: "text-primary",
      label: t("Séance"),
      title: event.session.customActivityLabel || meta.label,
    };
  }
  const meta = APPT_META[event.appointment.type];
  return {
    icon: meta.icon.name,
    chip: meta.chip,
    tint: meta.icon.color,
    tag: meta.tag,
    label: meta.label,
    title: event.appointment.title || meta.label,
  };
}
