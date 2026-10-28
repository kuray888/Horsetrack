import { NO_HEALTH_CONDITION, HORSE_SEXES, DISCIPLINES, HORSE_LEVELS, HORSE_FITNESS_LEVELS, HORSE_WORKLOADS } from "@/onboarding/options";
import type { Horse } from "@/horses/store";
import { t } from "@/i18n";

function labelOf<T extends string>(options: { value: T; label: string }[], value: T | null): string {
  if (value === null) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Résumé texte partageable d'un cheval (via Share.share côté appelant) —
 * extrait tel quel de l'ancien bloc "Mon écurie" de profile.tsx (cf. plan
 * Phase 3 Étape 6), déplacé vers le Horse Hub qui est maintenant la vue
 * complète d'un cheval. Pure fonction : aucun effet de bord ici. */
/** `downloadUrl` : lien de téléchargement ajouté en signature — chaque fiche
 * partagée fait connaître l'app à qui la reçoit (cf. lib/links.ts). */
export function buildHorseShareText(horse: Horse, downloadUrl: string | null = null): string {
  const currentYear = new Date().getFullYear();
  const lines: string[] = [t("🐴 Fiche de {name}", { name: horse.name }), ""];

  lines.push(t("📋 Profil"));
  if (horse.birthYear) lines.push(t("• Âge : {v} ans (né en {birthYear})", { v: currentYear - horse.birthYear, birthYear: horse.birthYear }));
  if (horse.sex) lines.push(t("• Sexe : {labelOf}", { labelOf: labelOf(HORSE_SEXES, horse.sex) }));
  if (horse.breed) lines.push(t("• Race : {breed}", { breed: horse.breed }));
  if (horse.coat) lines.push(t("• Robe : {coat}", { coat: horse.coat }));
  if (horse.heightCm) lines.push(t("• Taille : {heightCm} cm", { heightCm: horse.heightCm }));
  if (horse.weightKg) lines.push(t("• Poids : {weightKg} kg", { weightKg: horse.weightKg }));

  lines.push("", t("🏇 Activité"));
  lines.push(t("• Discipline : {labelOf}", { labelOf: labelOf(DISCIPLINES, horse.discipline) }));
  lines.push(t("• Niveau : {labelOf}", { labelOf: labelOf(HORSE_LEVELS, horse.level) }));
  if (horse.fitnessLevel) lines.push(t("• Forme : {labelOf}", { labelOf: labelOf(HORSE_FITNESS_LEVELS, horse.fitnessLevel) }));
  if (horse.workload) lines.push(t("• Charge : {labelOf}", { labelOf: labelOf(HORSE_WORKLOADS, horse.workload) }));

  if (horse.strengths.length > 0) lines.push("", t("💪 Points forts : {v}", { v: horse.strengths.map((s) => t(s)).join(", ") }));
  if (horse.weaknesses.length > 0) lines.push(t("⚠️ À travailler : {v}", { v: horse.weaknesses.map((w) => t(w)).join(", ") }));

  const activeConditions = horse.healthConditions.filter((c) => c !== NO_HEALTH_CONDITION);
  const activeInjuries = horse.injuries.filter((i) => i.recoveryStatus !== "RECOVERED");
  if (activeConditions.length > 0 || activeInjuries.length > 0) {
    lines.push("", t("🩺 Santé"));
    activeConditions.forEach((c) => lines.push(`• ${t(c)}`));
    activeInjuries.forEach((i) => lines.push(`• ${t(i.type)}${i.note ? ` — ${i.note}` : ""}`));
  }

  lines.push("", "—", downloadUrl ? t("Créé avec Horsetrack · {downloadUrl}", { downloadUrl: downloadUrl }) : t("Créé avec Horsetrack"));

  return lines.join("\n");
}
