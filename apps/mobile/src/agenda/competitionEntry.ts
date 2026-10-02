import type { CompetitionEntry } from "@/agenda/store";

/**
 * Règles d'une épreuve de concours, partagées par les deux formulaires (création
 * du concours, ajout/modification depuis sa carte) et par le store. Module pur,
 * testable sous Vitest sans passer par react-native.
 *
 * Seul le NOM est requis : l'heure de passage est le plus souvent communiquée
 * après l'engagement, et l'exiger empêchait de créer l'épreuve — ou la faisait
 * disparaître en silence à la création du concours. Une heure absente reste une
 * chaîne vide, comme pour une séance ou un rendez-vous sans heure (colonne
 * `time` NOT NULL côté serveur, cf. schema.prisma CompetitionEntry) : jamais une
 * valeur inventée. L'heure est un texte libre (« 09h15 »), sans date propre —
 * le jour est celui du concours —, donc sans aucun calcul de fuseau.
 */

type EntryFields = Pick<CompetitionEntry, "name" | "discipline" | "time">;

/** L'épreuve nettoyée (nom et heure sans espaces superflus), ou null si elle
 * n'a pas de nom — la seule information indispensable. */
export function cleanCompetitionEntry<T extends EntryFields>(entry: T): T | null {
  const name = entry.name.trim();
  if (!name) return null;
  return { ...entry, name, time: (entry.time ?? "").trim() };
}

/** Texte de l'heure à afficher : l'heure saisie, ou « heure à venir ». */
export function competitionEntryTimeLabel(time: string | null | undefined): string {
  return time?.trim() || "heure à venir";
}
