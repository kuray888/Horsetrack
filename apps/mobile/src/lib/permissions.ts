import type { CollaboratorRole } from "@/lib/sharing";
import { t } from "@/i18n";

/**
 * Droits par rôle sur un cheval (Écurie Pro v2). Copie de la matrice
 * `horse_role_can` de packages/db/prisma/rls.sql, qui fait foi : la base
 * refuse de toute façon ce qui sort de ces droits ; l'app ne fait que cacher
 * les actions impossibles. permissions.test.ts vérifie que les deux
 * concordent. Logique pure.
 */

/** "LEGACY" : partage d'avant les droits par rôle, qui garde les droits
 * d'alors (tout sur le cheval sauf l'équipe) jusqu'à ce que le propriétaire
 * applique ceux du rôle — cf. rls.sql, colonne fullAccess. */
export type HorseRole = "OWNER" | CollaboratorRole | "LEGACY";

export type Capability =
  | "read"
  | "edit_details"
  | "manage_sharing"
  | "manage_sessions"
  | "own_sessions"
  | "manage_care"
  | "add_care"
  | "manage_competitions"
  | "manage_journal"
  | "add_journal"
  | "manage_expenses"
  | "manage_fees"
  | "manage_tasks"
  | "moderate"
  | "manage_planning";

const ALL: HorseRole[] = ["OWNER", "LEGACY", "MANAGER", "COACH", "DEMI_PENSION", "RIDER", "GROOM", "VET", "FARRIER"];

export const CAPABILITIES: Record<Capability, HorseRole[]> = {
  // VIEWER (invitation gratuite, lecture seule) : lire, rien d'autre.
  read: [...ALL, "VIEWER"],
  edit_details: ["OWNER", "LEGACY", "MANAGER"],
  manage_sharing: ["OWNER", "MANAGER"],
  manage_sessions: ["OWNER", "LEGACY", "MANAGER", "COACH"],
  own_sessions: ["OWNER", "LEGACY", "MANAGER", "COACH", "DEMI_PENSION", "RIDER"],
  manage_care: ["OWNER", "LEGACY", "MANAGER"],
  add_care: ["OWNER", "LEGACY", "MANAGER", "GROOM", "VET", "FARRIER"],
  manage_competitions: ["OWNER", "LEGACY", "MANAGER", "COACH"],
  manage_journal: ["OWNER", "LEGACY", "MANAGER"],
  add_journal: ALL,
  manage_expenses: ["OWNER", "LEGACY", "MANAGER"],
  manage_fees: ["OWNER", "MANAGER"],
  manage_tasks: ["OWNER", "MANAGER", "GROOM"],
  moderate: ["OWNER", "MANAGER"],
  manage_planning: ["OWNER", "MANAGER", "COACH"],
};

export function can(role: HorseRole | null | undefined, capability: Capability): boolean {
  return !!role && CAPABILITIES[capability].includes(role);
}

/**
 * Auteur d'une ligne vu depuis l'app : `undefined` = créée sur cet appareil
 * et pas encore relue du serveur (donc par soi), `null` = ligne antérieure
 * aux droits par rôle (personne : seul « tout modifier » s'applique).
 */
export type Author = string | null | undefined;

export function isMine(createdByUserId: Author, me: string | null): boolean {
  return createdByUserId === undefined || (!!me && createdByUserId === me);
}

/** Tout avec `manage`, les siens avec `own` (cf. rls.sql horse_can_write). */
export function canWrite(
  role: HorseRole | null | undefined,
  manage: Capability,
  own: Capability,
  createdByUserId: Author,
  me: string | null
): boolean {
  return can(role, manage) || (can(role, own) && isMine(createdByUserId, me));
}

/** Type de rendez-vous, en local (« concours ») comme en base (« CONCOURS »). */
const isCompetition = (type: string) => type.toUpperCase() === "CONCOURS";

/** Un concours relève du sportif, tout autre rendez-vous des soins. */
export function canWriteAppointment(
  role: HorseRole | null | undefined,
  type: string,
  createdByUserId: Author,
  me: string | null
): boolean {
  if (isCompetition(type)) return can(role, "manage_competitions");
  return canWrite(role, "manage_care", "add_care", createdByUserId, me);
}

/** Types de rendez-vous qu'on peut créer sur ce cheval. */
export function canCreateAppointment(role: HorseRole | null | undefined, type: string): boolean {
  return isCompetition(type) ? can(role, "manage_competitions") : can(role, "add_care");
}

export function canWriteSession(role: HorseRole | null | undefined, createdByUserId: Author, me: string | null): boolean {
  return canWrite(role, "manage_sessions", "own_sessions", createdByUserId, me);
}

export function canWriteJournal(role: HorseRole | null | undefined, createdByUserId: Author, me: string | null): boolean {
  return canWrite(role, "manage_journal", "add_journal", createdByUserId, me);
}

export function canWriteWeight(role: HorseRole | null | undefined, createdByUserId: Author, me: string | null): boolean {
  return canWrite(role, "manage_care", "add_care", createdByUserId, me);
}

/** Rôle sur un cheval de la liste locale, d'après son `sharedRole` :
 * propriétaire si null (non partagé), aucun si undefined (cheval absent).
 * `fullAccess` : partage d'avant les droits par rôle (cf. HorseRole). Prend la valeur et non le cheval : le React Compiler suppose sinon que la
 * fonction peut modifier l'objet et renonce à mémoïser le composant. */
export function roleOf(sharedRole: CollaboratorRole | null | undefined, fullAccess?: boolean): HorseRole | null {
  if (sharedRole === undefined) return null;
  if (sharedRole && fullAccess) return "LEGACY";
  return sharedRole ?? "OWNER";
}

/** Entrées du « + » (QuickAddSheet) permises sur le cheval actif. */
export const QUICK_ADD_CAPABILITY = {
  cheval: null,
  direct: "own_sessions",
  seance: "own_sessions",
  soin: "add_care",
  rendezvous: "add_care",
  concours: "manage_competitions",
  depense: "manage_expenses",
  journal: "add_journal",
} as const satisfies Record<string, Capability | null>;

export function quickAddAllowed(role: HorseRole | null | undefined, option: keyof typeof QUICK_ADD_CAPABILITY): boolean {
  const capability = QUICK_ADD_CAPABILITY[option];
  return capability === null || can(role ?? "OWNER", capability);
}

/** Séance qui « me » concerne (rappels, « C'est fait ») : celle qu'on m'a
 * attribuée ; sans cavalier attribué, toutes celles de mes chevaux et, sur un
 * cheval partagé, celles que j'ai créées. */
export function isMySession(
  role: HorseRole | null | undefined,
  session: { createdByUserId?: Author; riderUserId?: string | null; riderName?: string | null },
  me: string | null
): boolean {
  if (session.riderUserId) return !!me && session.riderUserId === me;
  if (session.riderName?.trim()) return false;
  return !role || role === "OWNER" || role === "LEGACY" || isMine(session.createdByUserId, me);
}

/** Message d'un ajout refusé par le rôle (filet de sécurité des formulaires :
 * les entrées sont normalement déjà masquées). */
export function notAllowedMessage(): string {
  return t("Ton rôle sur ce cheval ne permet pas cet ajout. Demande au propriétaire ou au gérant de l'écurie.");
}
