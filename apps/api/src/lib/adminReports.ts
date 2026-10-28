/**
 * Rapports de la console d'administration (/admin) — logique pure, testée
 * (adminReports.test.ts) : inscriptions par semaine pour le graphique, et
 * fichiers CSV à ouvrir dans Excel ou Numbers.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Libellés partagés par la page et les exports CSV. */
export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Abonné",
  TRIALING: "Essai",
  EXPIRED: "Gratuit",
  CANCELLED: "Résilié",
};

export const REDEMPTION_LABEL: Record<string, string> = {
  APPLIED: "Premium accordé",
  ALREADY_PREMIUM: "Déjà Premium",
  STORE_REDIRECTED: "Envoyé au store",
  CONVERTED: "Achat confirmé",
};

const parisDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Jour calendaire à Paris, sous forme de minuit UTC de ce jour (pour compter
 * en jours sans dépendre du changement d'heure). */
function parisDay(date: Date): number {
  return Date.parse(`${parisDayFmt.format(date)}T00:00:00Z`);
}

/** Lundi (heure de Paris) de la semaine d'un jour donné par parisDay. */
function mondayOf(day: number): number {
  const weekday = (new Date(day).getUTCDay() + 6) % 7; // 0 = lundi
  return day - weekday * DAY_MS;
}

export type WeekBucket = {
  /** Lundi de la semaine, AAAA-MM-JJ (heure de Paris). */
  weekStart: string;
  count: number;
};

/**
 * Inscriptions par semaine (lundi → dimanche, heure de Paris), les `weeks`
 * dernières semaines, semaine en cours comprise et en dernier. Une semaine
 * sans inscription vaut 0 : le graphique ne saute jamais de semaine.
 */
export function bucketByWeek(dates: Date[], weeks: number, now: Date): WeekBucket[] {
  const current = mondayOf(parisDay(now));
  const starts = Array.from({ length: weeks }, (_, i) => current - (weeks - 1 - i) * 7 * DAY_MS);
  const counts = new Map(starts.map((s) => [s, 0]));
  for (const d of dates) {
    const monday = mondayOf(parisDay(d));
    if (counts.has(monday)) counts.set(monday, counts.get(monday)! + 1);
  }
  return starts.map((s) => ({ weekStart: new Date(s).toISOString().slice(0, 10), count: counts.get(s)! }));
}

// --- CSV -----------------------------------------------------------------------

/** Date et heure de Paris, triables : « 2026-10-28 14:05 ». */
const parisDateTimeFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export type CsvValue = string | number | boolean | Date | null | undefined;

/**
 * Une cellule qui commence par = + - @ (ou une tabulation, un retour) serait
 * exécutée comme formule par Excel : un email ou une description saisis par
 * n'importe qui pourraient alors lancer un calcul ou un lien. Préfixée d'une
 * apostrophe, elle reste du texte (même règle que l'export de l'app, cf.
 * apps/mobile/src/export/dataExport.ts).
 */
function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? parisDateTimeFmt.format(value)
      : typeof value === "boolean"
        ? value
          ? "oui"
          : "non"
        : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV pour Excel en français : séparateur « ; », fins de ligne Windows, et
 * marque UTF-8 en tête pour que les accents s'affichent correctement.
 */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
