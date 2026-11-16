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

/**
 * Types masqués à la CRÉATION dans cette version (décision du 2026-11-16) :
 * une app 1.2.0 qui partage le cheval planterait en lisant « masseur »
 * (`APPT_META[type].label` introuvable). À ouvrir en 1.4.0, quand la 1.2.0
 * ne circulera plus. La lecture reste prise en charge partout.
 */
const HIDDEN_AT_CREATION: readonly KnownAppointmentType[] = ["masseur"];

/** Types proposés dans le formulaire ; `current` : type du rendez-vous modifié. */
export function creatableAppointmentTypes(current: string | null): KnownAppointmentType[] {
  return APPOINTMENT_TYPES.filter((type) => !HIDDEN_AT_CREATION.includes(type) || type === current);
}
