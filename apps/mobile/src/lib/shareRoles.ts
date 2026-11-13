import type { CollaboratorRole } from "@/lib/sharing";

/**
 * Invitation gratuite (2026-11-13) : un compte gratuit peut inviter une
 * personne par cheval en lecture seule (VIEWER) ; les rôles qui écrivent
 * restent Premium. Même règle côté serveur (rls.sql, section
 * invitation-gratuite). Logique pure, testée dans shareRoles.test.ts.
 */
export function inviteRoleAvailable(role: CollaboratorRole, isPremium: boolean): boolean {
  return isPremium || role === "VIEWER";
}

export function defaultInviteRole(isPremium: boolean): CollaboratorRole {
  return isPremium ? "DEMI_PENSION" : "VIEWER";
}
