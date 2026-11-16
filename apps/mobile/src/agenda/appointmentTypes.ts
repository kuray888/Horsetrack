/**
 * Types de rendez-vous connus de cette version, dans l'ordre de l'énumération
 * Postgres `appointment_type` (packages/db/prisma/schema.prisma). Une version
 * plus récente peut en ajouter un (« masseur » en 1.3.0) : une ancienne
 * version qui le lisait tel quel plantait à l'affichage (libellé introuvable).
 */
export const APPOINTMENT_TYPES = [
  "veto",
  "osteo",
  "masseur",
  "marechal",
  "dentiste",
  "vaccination",
  "vermifuge",
  "traitement",
  "concours",
  "autre",
] as const;

export type KnownAppointmentType = (typeof APPOINTMENT_TYPES)[number];

/** Type relu du serveur : inconnu de cette version → « autre », jamais une erreur. */
export function appointmentTypeFromServer(value: unknown): KnownAppointmentType {
  const lower = String(value ?? "").toLowerCase();
  return (APPOINTMENT_TYPES as readonly string[]).includes(lower) ? (lower as KnownAppointmentType) : "autre";
}
