/**
 * Lecture des dates renvoyées par Supabase (PostgREST).
 *
 * Les colonnes de date sont des `DateTime` Prisma sans annotation, donc des
 * `timestamp(3)` SANS fuseau en base (cf. packages/db/prisma/schema.prisma).
 * L'app y écrit `toISOString()` — l'heure UTC suivie de « Z » — mais Postgres
 * ignore tout fuseau à l'entrée d'une telle colonne et n'en garde que
 * l'horloge UTC, puis PostgREST la renvoie SANS décalage :
 * `"2026-10-02T22:00:00"` pour une séance du 3 octobre à minuit à Paris.
 *
 * Or une chaîne date-heure sans décalage est lue en heure LOCALE par
 * `new Date()` (spécification ECMAScript, suivie par Hermes) : la séance
 * revenait le 2 octobre à 22 h — la veille — à chaque relecture du serveur,
 * c'est-à-dire à chaque lancement de l'app (cf. lib/cloudRefresh.tsx), et
 * dérivait encore de 2 h à chaque renvoi (cf. audit du 2026-10-02).
 *
 * Ces valeurs sont de l'UTC (c'est ce que l'app écrit, et ce que Prisma lit
 * et écrit côté API) : on les lit donc en UTC, explicitement, sans dépendre
 * de l'interprétation du moteur JavaScript. Une valeur qui porte déjà un
 * fuseau (colonne `timestamptz`) est lue telle quelle.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

export function parseServerDate(value: string): Date {
  const match = ISO.exec(value.trim());
  // Format inattendu : mieux vaut l'interprétation du moteur qu'une date perdue.
  if (!match) return new Date(value);
  const [, y, mo, d, h = "0", mi = "0", s = "0", fraction = "", zone] = match;
  const ms = Number(fraction.slice(0, 3).padEnd(3, "0"));
  let time = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms);
  if (zone && zone.toUpperCase() !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    const offsetMinutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || "0");
    time -= sign * offsetMinutes * 60_000;
  }
  return new Date(time);
}

export function parseServerDateOrNull(value: string | null | undefined): Date | null {
  return value ? parseServerDate(value) : null;
}
