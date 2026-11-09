import type { CollaboratorRole, CollaboratorStatus } from "@/lib/sharing";

/**
 * Équipe de l'écurie (Écurie Pro v2) : les partages de tous les chevaux
 * regroupés par personne — une demi-pension de deux chevaux est une seule
 * personne, avec deux lignes. Logique pure.
 */

export type ShareRow = {
  id: string;
  horseId: string;
  invitedEmail: string;
  collaboratorUserId: string | null;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  /** Ancien partage : garde les droits d'avant les rôles (cf. lib/permissions.ts). */
  fullAccess?: boolean;
};

export type TeamPerson = {
  /** Adresse en minuscules : la clé d'une personne, invitée ou non. */
  email: string;
  name: string | null;
  userId: string | null;
  shares: (ShareRow & { horseName: string })[];
  /** Au moins un partage accepté. */
  active: boolean;
};

export function groupTeam(
  rows: ShareRow[],
  horses: { id: string; name: string }[],
  names: Map<string, string>
): TeamPerson[] {
  const horseName = new Map(horses.map((h) => [h.id, h.name]));
  const people = new Map<string, TeamPerson>();
  for (const row of rows) {
    if (!horseName.has(row.horseId)) continue;
    const email = row.invitedEmail.trim().toLowerCase();
    const person = people.get(email) ?? { email, name: null, userId: null, shares: [], active: false };
    person.shares.push({ ...row, horseName: horseName.get(row.horseId) as string });
    if (row.collaboratorUserId) {
      person.userId = row.collaboratorUserId;
      person.name = names.get(row.collaboratorUserId) ?? person.name;
    }
    if (row.status === "ACCEPTED") person.active = true;
    people.set(email, person);
  }
  for (const p of people.values()) p.shares.sort((a, b) => a.horseName.localeCompare(b.horseName));
  return [...people.values()].sort(
    (a, b) => Number(b.active) - Number(a.active) || (a.name ?? a.email).localeCompare(b.name ?? b.email)
  );
}

/** Chevaux auxquels on peut encore inviter cette adresse (pas déjà
 * partagés avec elle). */
export function invitableHorses<T extends { id: string }>(horses: T[], person: TeamPerson | null): T[] {
  if (!person) return horses;
  const already = new Set(person.shares.map((s) => s.horseId));
  return horses.filter((h) => !already.has(h.id));
}

export type InviteOutcome = "ok" | "duplicate" | "quota" | "not_premium" | "error";

/** Résumé d'une invitation sur plusieurs chevaux. */
export function summarizeInvites(results: { horseName: string; result: InviteOutcome }[]): {
  sent: string[];
  full: string[];
  failed: string[];
} {
  return {
    sent: results.filter((r) => r.result === "ok" || r.result === "duplicate").map((r) => r.horseName),
    full: results.filter((r) => r.result === "quota").map((r) => r.horseName),
    failed: results.filter((r) => r.result === "error" || r.result === "not_premium").map((r) => r.horseName),
  };
}
