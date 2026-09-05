import { NO_HEALTH_CONDITION, HORSE_SEXES, DISCIPLINES, HORSE_LEVELS, HORSE_FITNESS_LEVELS, HORSE_WORKLOADS } from "@/onboarding/options";
import type { Horse } from "@/horses/store";

function labelOf<T extends string>(options: { value: T; label: string }[], value: T | null): string {
  if (value === null) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Résumé texte partageable d'un cheval (via Share.share côté appelant) —
 * extrait tel quel de l'ancien bloc "Mon écurie" de profile.tsx (cf. plan
 * Phase 3 Étape 6), déplacé vers le Horse Hub qui est maintenant la vue
 * complète d'un cheval. Pure fonction : aucun effet de bord ici. */
export function buildHorseShareText(horse: Horse): string {
  const currentYear = new Date().getFullYear();
  const lines: string[] = [`🐴 Fiche de ${horse.name}`, ""];

  lines.push("📋 Profil");
  if (horse.birthYear) lines.push(`• Âge : ${currentYear - horse.birthYear} ans (né en ${horse.birthYear})`);
  if (horse.sex) lines.push(`• Sexe : ${labelOf(HORSE_SEXES, horse.sex)}`);
  if (horse.breed) lines.push(`• Race : ${horse.breed}`);
  if (horse.coat) lines.push(`• Robe : ${horse.coat}`);
  if (horse.heightCm) lines.push(`• Taille : ${horse.heightCm} cm`);
  if (horse.weightKg) lines.push(`• Poids : ${horse.weightKg} kg`);

  lines.push("", "🏇 Activité");
  lines.push(`• Discipline : ${labelOf(DISCIPLINES, horse.discipline)}`);
  lines.push(`• Niveau : ${labelOf(HORSE_LEVELS, horse.level)}`);
  if (horse.fitnessLevel) lines.push(`• Forme : ${labelOf(HORSE_FITNESS_LEVELS, horse.fitnessLevel)}`);
  if (horse.workload) lines.push(`• Charge : ${labelOf(HORSE_WORKLOADS, horse.workload)}`);

  if (horse.strengths.length > 0) lines.push("", `💪 Points forts : ${horse.strengths.join(", ")}`);
  if (horse.weaknesses.length > 0) lines.push(`⚠️ À travailler : ${horse.weaknesses.join(", ")}`);

  const activeConditions = horse.healthConditions.filter((c) => c !== NO_HEALTH_CONDITION);
  const activeInjuries = horse.injuries.filter((i) => i.recoveryStatus !== "RECOVERED");
  if (activeConditions.length > 0 || activeInjuries.length > 0) {
    lines.push("", "🩺 Santé");
    activeConditions.forEach((c) => lines.push(`• ${c}`));
    activeInjuries.forEach((i) => lines.push(`• ${i.type}${i.note ? ` — ${i.note}` : ""}`));
  }

  lines.push("", "—", "Créé avec Horsetrack");

  return lines.join("\n");
}
