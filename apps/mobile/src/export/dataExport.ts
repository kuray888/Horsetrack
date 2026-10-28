import { buildZip, utf8, type ZipEntry } from "@/export/zip";
import { isoDay } from "@/lib/dateFormat";
import { LANG, localDecimal, t } from "@/i18n";

/**
 * Export complet des données du cavalier : un CSV par type de donnée, réunis
 * dans un .zip. Pour garder une copie, changer d'outil, ou exercer le droit à
 * la portabilité (RGPD, art. 20).
 *
 * Logique pure : l'écran passe les données des stores et les libellés
 * (agenda/meta.ts, onboarding/options.ts), ce module ne lit rien lui-même —
 * c'est ce qui le rend testable sans React ni fichier (cf. dataExport.test.ts).
 *
 * Format choisi pour Excel en français, l'usage le plus probable : séparateur
 * « ; », virgule décimale, BOM UTF-8 (sans lui, Excel lit les accents de
 * travers). Numbers, Google Sheets et LibreOffice lisent ce format aussi.
 */

export type ExportLabelKind =
  | "activity"
  | "mood"
  | "appointmentType"
  | "expenseCategory"
  | "documentCategory"
  | "horseSex"
  | "horseLevel"
  | "discipline"
  | "intensity"
  | "goalType"
  | "sharedRole"
  | "recoveryStatus";

export type ExportLabels = Record<ExportLabelKind, Record<string, string>>;

export type ExportHorse = {
  id: string;
  name: string;
  birthYear: number | null;
  sex: string | null;
  breed: string | null;
  coat: string | null;
  heightCm: number | null;
  weightKg: number | null;
  discipline: string | null;
  level: string | null;
  healthConditions: string[];
  injuries: { type: string; occurredAt: Date | null; recoveryStatus: string | null; note: string }[];
  sharedRole: string | null;
};

export type ExportSession = {
  horseId: string | null;
  date: Date;
  time: string;
  activityType: string;
  customActivityLabel: string | null;
  durationMinutes: number | null;
  intensity: string | null;
  completed: boolean;
  notes: string;
};

export type ExportAppointment = {
  horseId: string | null;
  type: string;
  title: string;
  date: Date;
  endDate: Date | null;
  time: string;
  location: string;
  professional: string | null;
  cost: number | null;
  nextDueDate: Date | null;
  result: string | null;
  dossard: string | null;
  competitionLevel: string | null;
  notes: string;
  competitionEntries: { name: string; discipline: string; time: string; result: string | null }[];
};

export type ExportJournalEntry = {
  horseId: string | null;
  date: Date;
  time: string;
  activityType: string;
  mood: string;
  notes: string;
  weather: { tempC: number; label: string } | null;
  photoUri: string | null;
};

export type ExportExpense = {
  horseId: string | null;
  date: Date;
  category: string;
  amount: number;
  currency: string;
  isPaid: boolean;
  notes: string;
};

export type ExportWeight = { horseId: string; date: Date; weightKg: number };
export type ExportDocument = { horseId: string | null; date: Date; category: string; name: string };
export type ExportGoal = {
  title: string;
  type: string | null;
  customType: string | null;
  targetDate: Date | null;
  horseId: string | null;
};

export type ExportData = {
  horses: ExportHorse[];
  sessions: ExportSession[];
  appointments: ExportAppointment[];
  journal: ExportJournalEntry[];
  expenses: ExportExpense[];
  weights: ExportWeight[];
  documents: ExportDocument[];
  goals: ExportGoal[];
};

type Cell = string | number | boolean | Date | null | undefined;

export function formatCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : isoDay(value);
  if (typeof value === "boolean") return value ? t("oui") : t("non");
  if (typeof value === "number") return Number.isFinite(value) ? localDecimal(String(value)) : "";
  // Une cellule texte qui commence par = + - @ serait lue comme une formule
  // par Excel : une note « =HYPERLINK(...) » s'exécuterait à l'ouverture. On
  // la neutralise par une apostrophe, la parade recommandée (OWASP).
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Séparateur attendu par Excel dans la langue de l'app : « ; » en français
 * (la virgule y est décimale), « , » en anglais. */
const SEP = LANG === "fr" ? ";" : ",";

function escapeCsv(text: string): string {
  return text.includes(SEP) || /["\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map((c) => escapeCsv(formatCell(c))).join(SEP));
  return `﻿${lines.join("\r\n")}\r\n`;
}

function byDate<T extends { date: Date }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildExportFiles(data: ExportData, labels: ExportLabels): { name: string; content: string }[] {
  const label = (kind: ExportLabelKind, value: string | null | undefined) =>
    value ? (labels[kind][value] ?? value) : "";
  const horseNames = new Map(data.horses.map((h) => [h.id, h.name]));
  const horseName = (id: string | null) => (id ? (horseNames.get(id) ?? "") : "");

  const chevaux = toCsv(
    [
      t("Nom"),
      t("Année de naissance"),
      t("Sexe"),
      t("Race"),
      t("Robe"),
      t("Taille (cm)"),
      t("Poids (kg)"),
      t("Discipline"),
      t("Niveau"),
      t("Accès"),
      t("Particularités de santé"),
      t("Blessures"),
    ],
    data.horses.map((h) => [
      h.name,
      h.birthYear,
      label("horseSex", h.sex),
      h.breed,
      h.coat,
      h.heightCm,
      h.weightKg,
      label("discipline", h.discipline),
      label("horseLevel", h.level),
      h.sharedRole ? t("Partagé ({label})", { label: label("sharedRole", h.sharedRole) }) : t("Propriétaire"),
      h.healthConditions.join(", "),
      h.injuries
        .map((i) =>
          [i.type, i.occurredAt ? isoDay(i.occurredAt) : "", label("recoveryStatus", i.recoveryStatus), i.note]
            .filter(Boolean)
            .join(" · ")
        )
        .join(" | "),
    ])
  );

  const seances = toCsv(
    [t("Date"), t("Heure"), t("Cheval"), t("Activité"), t("Durée (min)"), t("Intensité"), t("Faite"), t("Notes")],
    byDate(data.sessions).map((s) => [
      s.date,
      s.time,
      horseName(s.horseId),
      s.customActivityLabel || label("activity", s.activityType),
      s.durationMinutes,
      label("intensity", s.intensity),
      s.completed,
      s.notes,
    ])
  );

  const rendezVous = toCsv(
    [
      t("Date"),
      t("Fin"),
      t("Heure"),
      t("Cheval"),
      t("Type"),
      t("Titre"),
      t("Lieu"),
      t("Professionnel"),
      t("Coût"),
      t("Prochaine échéance"),
      t("Résultat"),
      t("Dossard"),
      t("Niveau"),
      t("Notes"),
    ],
    byDate(data.appointments).map((a) => [
      a.date,
      a.endDate,
      a.time,
      horseName(a.horseId),
      label("appointmentType", a.type),
      a.title,
      a.location,
      a.professional,
      a.cost,
      a.nextDueDate,
      a.result,
      a.dossard,
      a.competitionLevel,
      a.notes,
    ])
  );

  const epreuves = toCsv(
    [t("Date du concours"), t("Cheval"), t("Concours"), t("Épreuve"), t("Discipline"), t("Heure"), t("Résultat")],
    byDate(data.appointments).flatMap((a) =>
      a.competitionEntries.map((e) => [
        a.date,
        horseName(a.horseId),
        a.title,
        e.name,
        label("discipline", e.discipline),
        e.time,
        e.result,
      ])
    )
  );

  const journal = toCsv(
    [t("Date"), t("Heure"), t("Cheval"), t("Activité"), t("Ressenti"), t("Météo"), t("Notes"), t("Photo")],
    byDate(data.journal).map((j) => [
      j.date,
      j.time,
      horseName(j.horseId),
      label("activity", j.activityType),
      label("mood", j.mood),
      j.weather ? t("{label}, {v} °C", { label: j.weather.label, v: Math.round(j.weather.tempC) }) : "",
      j.notes,
      !!j.photoUri,
    ])
  );

  const depenses = toCsv(
    [t("Date"), t("Cheval"), t("Catégorie"), t("Montant"), t("Devise"), t("Payée"), t("Notes")],
    byDate(data.expenses).map((e) => [
      e.date,
      horseName(e.horseId),
      label("expenseCategory", e.category),
      e.amount,
      e.currency,
      e.isPaid,
      e.notes,
    ])
  );

  const poids = toCsv(
    [t("Date"), t("Cheval"), t("Poids (kg)")],
    byDate(data.weights).map((w) => [w.date, horseName(w.horseId), w.weightKg])
  );

  const documents = toCsv(
    [t("Date"), t("Cheval"), t("Catégorie"), t("Nom")],
    byDate(data.documents).map((d) => [d.date, horseName(d.horseId), label("documentCategory", d.category), d.name])
  );

  const objectifs = toCsv(
    [t("Objectif"), t("Type"), t("Échéance"), t("Cheval")],
    data.goals.map((g) => [g.title, g.customType || label("goalType", g.type), g.targetDate, horseName(g.horseId)])
  );

  const readme = [
    t("Export Horsetrack"),
    "",
    t("Un fichier par type de donnée, lisible dans Excel, Numbers, Google Sheets ou LibreOffice."),
    t("Séparateur : point-virgule. Dates au format AAAA-MM-JJ."),
    "",
    t("Les photos et les fichiers du coffre-fort ne sont pas inclus : le fichier documents.csv"),
    t("en donne la liste. Ils restent consultables et partageables depuis l'app."),
    "",
  ].join("\r\n");

  return [
    { name: "LISEZMOI.txt", content: readme },
    { name: "chevaux.csv", content: chevaux },
    { name: "seances.csv", content: seances },
    { name: "rendez-vous.csv", content: rendezVous },
    { name: "epreuves-concours.csv", content: epreuves },
    { name: "journal.csv", content: journal },
    { name: "depenses.csv", content: depenses },
    { name: "poids.csv", content: poids },
    { name: "documents.csv", content: documents },
    { name: "objectifs.csv", content: objectifs },
  ];
}

export function buildExportZip(data: ExportData, labels: ExportLabels, now: Date = new Date()): Uint8Array {
  const entries: ZipEntry[] = buildExportFiles(data, labels).map((f) => ({ name: f.name, data: utf8(f.content) }));
  return buildZip(entries, now);
}

export function exportFileName(now: Date): string {
  return `Horsetrack-export-${isoDay(now)}.zip`;
}
