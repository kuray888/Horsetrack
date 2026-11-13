/**
 * Qui peut gérer l'équipe d'un cheval (inviter, révoquer) depuis l'API —
 * miroir des policies horse_collaborators de rls.sql : le propriétaire, ou
 * un gérant (MANAGER) accepté, qui ne peut ni nommer ni retirer un autre
 * gérant. Logique pure, testée.
 */

export const COLLABORATOR_ROLES = ["DEMI_PENSION", "COACH", "RIDER", "GROOM", "MANAGER", "VET", "FARRIER", "VIEWER"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export type TeamActor = "owner" | "manager";

type HorseTeam = {
  owner: { userId: string };
  collaborators: { collaboratorUserId: string | null; role: string; status: string }[];
};

export function teamActor(horse: HorseTeam, userId: string): TeamActor | null {
  if (horse.owner.userId === userId) return "owner";
  const manager = horse.collaborators.some(
    (c) => c.collaboratorUserId === userId && c.role === "MANAGER" && c.status === "ACCEPTED"
  );
  return manager ? "manager" : null;
}

/** Inviter ou retirer une personne de ce rôle. */
export function canHandleRole(actor: TeamActor | null, role: string): boolean {
  if (actor === "owner") return true;
  return actor === "manager" && role !== "MANAGER";
}
