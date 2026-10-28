import { DISCIPLINES, HORSE_SEXES } from "@/onboarding/options";
import type { Discipline, HorseDraft } from "@/onboarding/store";
import { t } from "@/i18n";

/**
 * Aperçu de la fiche du cheval, montré juste avant le paywall (cf.
 * app/(onboarding)/summary.tsx) : le cavalier voit ce que l'app a déjà fait
 * de ce qu'il vient de saisir, avant qu'on lui propose de payer. Seuls les
 * champs remplis apparaissent — jamais une valeur inventée.
 */

export type PreviewFact = { label: string; value: string };

export type HorsePreview = {
  name: string;
  /** « Jument · 8 ans · Selle Français · Bai », null si rien n'est saisi. */
  subtitle: string | null;
  facts: PreviewFact[];
};

type DraftFields = Pick<HorseDraft, "name" | "birthYear" | "sex" | "breed" | "coat" | "heightCm" | "weightKg" | "discipline">;

export function horsePreview(horse: DraftFields, riderDiscipline: Discipline | null, now: Date): HorsePreview {
  const sex = HORSE_SEXES.find((o) => o.value === horse.sex)?.label ?? null;
  const age = horse.birthYear && horse.birthYear <= now.getFullYear() ? now.getFullYear() - horse.birthYear : null;
  const ageLabel = age === null ? null : age < 1 ? t("moins d'un an") : age === 1 ? t("1 an") : t("{v} ans", { v: age });
  const subtitle = [sex, ageLabel, horse.breed?.trim() || null, horse.coat?.trim() || null].filter(Boolean).join(" · ");

  const discipline = DISCIPLINES.find((d) => d.value === (horse.discipline ?? riderDiscipline))?.label ?? null;
  const facts: PreviewFact[] = [];
  if (discipline) facts.push({ label: t("Discipline"), value: discipline });
  if (horse.heightCm) facts.push({ label: t("Taille"), value: t("{v} cm", { v: horse.heightCm }) });
  if (horse.weightKg) facts.push({ label: t("Poids"), value: t("{v} kg", { v: horse.weightKg }) });
  if (horse.birthYear) facts.push({ label: t("Né en"), value: String(horse.birthYear) });

  return { name: horse.name.trim() || t("Ton cheval"), subtitle: subtitle || null, facts };
}
