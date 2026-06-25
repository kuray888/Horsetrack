import { supabase } from "@/lib/supabase";
import { mapRemoteHorse, type RemoteHorse } from "@/lib/cloudSync";
import type { Horse } from "@/horses/store";

export type CollaboratorRole = "DEMI_PENSION" | "COACH";
export type CollaboratorStatus = "PENDING" | "ACCEPTED";

export type Collaborator = {
  id: string;
  invitedEmail: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
};

export type PendingInvite = {
  id: string;
  horseId: string;
  horseName: string;
  role: CollaboratorRole;
};

/**
 * Partage demi-pension/coach (cf. RLS can_access_horse, packages/db/prisma/rls.sql).
 * L'invité n'a pas besoin d'avoir déjà un compte au moment de l'invitation —
 * l'accès ne devient réel qu'à l'acceptation (cf. acceptInvite), quand son
 * email correspond enfin à un compte connecté (matching par auth.jwt() côté RLS).
 */

export async function inviteCollaborator(horseId: string, email: string, role: CollaboratorRole): Promise<boolean> {
  const { error } = await supabase.from("horse_collaborators").insert({
    horseId,
    invitedEmail: email.trim().toLowerCase(),
    role,
  });
  return !error;
}

export async function listCollaborators(horseId: string): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from("horse_collaborators")
    .select("id, invitedEmail, role, status")
    .eq("horseId", horseId);
  if (error || !data) return [];
  return data;
}

export async function revokeCollaborator(id: string): Promise<void> {
  await supabase.from("horse_collaborators").delete().eq("id", id);
}

/** Invitations en attente pour l'email du compte courant — affichées via
 * app/invites-modal.tsx juste après connexion/inscription (cf. (auth)/login.tsx,
 * (onboarding)/paywall.tsx). La policy RLS `horse_collaborators_invitee_select`
 * filtre déjà aux lignes dont `invitedEmail` correspond au JWT courant. */
export async function pullPendingInvites(): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from("horse_collaborators")
    .select("id, horseId, role, horses(name)")
    .eq("status", "PENDING");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    horseName: (row.horses as unknown as { name: string } | null)?.name ?? "ce cheval",
    role: row.role,
  }));
}

export async function acceptInvite(id: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;
  const { error } = await supabase
    .from("horse_collaborators")
    .update({ status: "ACCEPTED", collaboratorUserId: userId })
    .eq("id", id);
  return !error;
}

/** Chevaux partagés (collaboration ACCEPTED) avec l'utilisateur courant — à
 * fusionner avec les chevaux possédés dans useHorses() (cf. horses/store.tsx
 * `pullCloudData`/`hydrateFromCloud`). Réutilise `mapRemoteHorse` (cf.
 * lib/cloudSync.ts) : même forme de requête Supabase imbriquée que pour les
 * chevaux possédés, juste un point d'entrée différent (horse_collaborators
 * plutôt que rider_profiles). */
export async function pullSharedHorses(): Promise<(Horse & { sharedRole: CollaboratorRole })[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("horse_collaborators")
    .select("role, horses(*, horse_traits(*), horse_injuries(*))")
    .eq("collaboratorUserId", userId)
    .eq("status", "ACCEPTED");
  if (error || !data) return [];

  return data
    .filter((row) => row.horses)
    .map((row) => ({
      ...mapRemoteHorse(row.horses as unknown as RemoteHorse),
      // "Primaire" est un concept côté propriétaire (cf. onboarding) — un
      // cheval partagé ne doit jamais devenir le cheval par défaut sélectionné
      // juste parce que SON propriétaire l'a marqué primaire chez lui.
      isPrimary: false,
      sharedRole: row.role as CollaboratorRole,
    }));
}
