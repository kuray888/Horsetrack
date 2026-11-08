import { can, canWriteSession, type Author, type HorseRole } from "@/lib/permissions";

/**
 * Qui monte quelle séance (Écurie Pro v2). Une séance peut être attribuée à
 * un compte de l'équipe du cheval (`riderUserId`) ou à quelqu'un sans compte
 * (`riderName`, simple nom). Le cavalier attribué peut la cocher « C'est
 * fait », pas la modifier (cf. rls.sql planning-seances). Logique pure.
 */

export type TeamMember = { userId: string; name: string; role: HorseRole };

export type RiderFields = { riderUserId?: string | null; riderName?: string | null };

/** Ce qu'on peut faire d'une séance : tout, la cocher seulement, ou rien. */
export type SessionAccess = "full" | "done" | "none";

export function sessionAccess(
  role: HorseRole | null | undefined,
  session: RiderFields & { createdByUserId?: Author },
  me: string | null
): SessionAccess {
  if (canWriteSession(role, session.createdByUserId, me)) return "full";
  if (!!me && session.riderUserId === me) return "done";
  return "none";
}

/** Nom à afficher pour le cavalier : « toi », un membre de l'équipe, un nom
 * libre, ou null si la séance n'est attribuée à personne. Un compte absent de
 * l'équipe connue (liste pas encore chargée, personne partie) n'a pas de nom. */
export function riderDisplayName(
  session: RiderFields,
  team: TeamMember[],
  me: string | null,
  youLabel: string
): string | null {
  if (session.riderUserId) {
    if (session.riderUserId === me) return youLabel;
    return team.find((m) => m.userId === session.riderUserId)?.name ?? null;
  }
  const name = session.riderName?.trim();
  return name ? name : null;
}

/** À qui l'on peut attribuer une séance : toute l'équipe pour le coach, le
 * gérant ou le propriétaire ; soi-même seulement pour les autres. Soi en
 * premier. */
export function assignableRiders(role: HorseRole | null | undefined, team: TeamMember[], me: string | null): TeamMember[] {
  const members = can(role, "manage_sessions") ? team : team.filter((m) => m.userId === me);
  return [...members].sort((a, b) => Number(b.userId === me) - Number(a.userId === me));
}

/** Choix du formulaire → colonnes de la séance : un compte l'emporte sur un
 * nom libre, un nom vide vaut « personne ». */
export function riderColumns(riderUserId: string | null, riderName: string): { riderUserId: string | null; riderName: string | null } {
  if (riderUserId) return { riderUserId, riderName: null };
  const name = riderName.trim();
  return { riderUserId: null, riderName: name ? name.slice(0, 60) : null };
}
