import { HORSE_SEXES } from "@/onboarding/options";
import type { PdfTextLine } from "@/lib/pdfText";

/**
 * Contenu du carnet de santé exporté en PDF — le document qu'on envoie au
 * vétérinaire, qu'on emmène en concours ou qu'on remet à l'acheteur lors
 * d'une vente. L'app avait déjà toutes ces informations, mais elles ne
 * sortaient que sous forme de texte partagé (cf. shareHorseText.ts), inutile
 * face à un véto ou un acheteur.
 *
 * Module pur, sans react-native ni génération PDF (cf. lib/pdfText.ts pour
 * celle-ci) : ce qui figure au carnet se teste sans produire de fichier.
 *
 * Principe : on n'invente rien et on ne calcule aucun indicateur de santé.
 * Le carnet reporte ce qui a été saisi, daté, et rien d'autre — c'est un
 * relevé, pas un avis.
 */

/** Ce dont le carnet a besoin d'un cheval. Volontairement structurel plutôt
 * qu'un import de `Horse` : le module reste testable sans monter un store. */
export type RecordHorse = {
  name: string;
  birthYear: number | null;
  sex: string | null;
  breed: string | null;
  coat: string | null;
  heightCm: number | null;
  weightKg: number | null;
  healthConditions: string[];
  /** Reprend la forme d'InjuryRecord (cf. horses/injuries.ts) : le type de
   * blessure, la date si elle est connue, et le rétablissement — qui est un
   * STATUT et non une date dans le modèle, on ne peut donc pas dire quand. */
  injuries: { type: string; occurredAt: Date | null; recovered: boolean; note: string }[];
};

export type RecordAppointment = {
  type: string;
  typeLabel: string;
  title: string;
  date: Date;
  professional: string | null;
  nextDueDate: Date | null;
  notes: string;
};

export type RecordWeight = { date: Date; weightKg: number };

function formatDay(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Construit les lignes du carnet.
 *
 * `soins` arrive déjà filtré sur les types de santé par l'appelant (cf.
 * HEALTH_APPT_TYPES) : un concours n'a rien à faire dans un carnet de santé.
 */
export function buildHealthRecordLines(
  horse: RecordHorse,
  soins: RecordAppointment[],
  weights: RecordWeight[],
  today: Date
): PdfTextLine[] {
  const lines: PdfTextLine[] = [
    { style: "title", text: `Carnet de santé — ${horse.name}` },
    { style: "muted", text: `Établi le ${formatDay(today)} depuis HorseTrack` },
    { style: "space" },
  ];

  // — Identité —
  lines.push({ style: "heading", text: "Identité" });
  const identity: string[] = [];
  if (horse.birthYear) identity.push(`Né en ${horse.birthYear} (${today.getFullYear() - horse.birthYear} ans)`);
  const sexLabel = HORSE_SEXES.find((s) => s.value === horse.sex)?.label;
  if (sexLabel) identity.push(sexLabel);
  if (horse.breed) identity.push(horse.breed);
  if (horse.coat) identity.push(`Robe ${horse.coat.toLowerCase()}`);
  if (horse.heightCm) identity.push(`${horse.heightCm} cm au garrot`);
  if (horse.weightKg) identity.push(`${horse.weightKg} kg`);
  lines.push({ style: "body", text: identity.length > 0 ? identity.join(" · ") : "Aucune information renseignée." });
  lines.push({ style: "space" });

  // — Antécédents —
  lines.push({ style: "heading", text: "Antécédents" });
  if (horse.healthConditions.length === 0 && horse.injuries.length === 0) {
    // Dire qu'il n'y a rien de NOTÉ, pas qu'il n'y a rien : un carnet vide ne
    // prouve pas qu'un cheval n'a jamais rien eu, et le lecteur doit le savoir.
    lines.push({ style: "body", text: "Aucun antécédent noté dans l'application." });
  } else {
    for (const condition of horse.healthConditions) {
      lines.push({ style: "body", text: `• ${condition}` });
    }
    for (const injury of horse.injuries) {
      const period = injury.occurredAt ? formatDay(injury.occurredAt) : "date non précisée";
      const status = injury.recovered ? "rétabli" : "en cours";
      lines.push({ style: "body", text: `• ${injury.type} — ${period} (${status})` });
      if (injury.note.trim()) lines.push({ style: "muted", text: `   ${injury.note.trim()}` });
    }
  }
  lines.push({ style: "space" });

  // — Soins —
  lines.push({ style: "heading", text: "Soins et interventions" });
  if (soins.length === 0) {
    lines.push({ style: "body", text: "Aucun soin enregistré dans l'application." });
  } else {
    // Du plus récent au plus ancien : c'est l'ordre dans lequel on lit un
    // carnet, et la première ligne est celle qu'on cherche le plus souvent.
    for (const soin of [...soins].sort((a, b) => b.date.getTime() - a.date.getTime())) {
      lines.push({ style: "body", text: `${formatDay(soin.date)} — ${soin.typeLabel} : ${soin.title}` });
      const details: string[] = [];
      if (soin.professional) details.push(soin.professional);
      if (soin.nextDueDate) details.push(`prochaine échéance ${formatDay(soin.nextDueDate)}`);
      if (soin.notes.trim()) details.push(soin.notes.trim());
      if (details.length > 0) lines.push({ style: "muted", text: `   ${details.join(" · ")}` });
    }
  }
  lines.push({ style: "space" });

  // — Poids —
  lines.push({ style: "heading", text: "Suivi du poids" });
  if (weights.length === 0) {
    lines.push({ style: "body", text: "Aucune pesée enregistrée." });
  } else {
    // Les douze dernières suffisent à montrer une tendance ; au-delà, le
    // carnet devient un tableau qu'on ne lit plus.
    const recent = [...weights].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
    for (const weight of recent) {
      lines.push({ style: "body", text: `${formatDay(weight.date)} — ${weight.weightKg} kg` });
    }
  }

  lines.push({ style: "space" });
  lines.push({
    style: "muted",
    text: "Document généré à partir des informations saisies dans HorseTrack. Il ne remplace pas les documents officiels (carnet SIRE, certificats vétérinaires).",
  });
  return lines;
}
