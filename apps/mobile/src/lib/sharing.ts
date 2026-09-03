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

// La colonne `id` n'a pas de DEFAULT côté Postgres : `@default(cuid())` côté
// Prisma est une convention du client Prisma (génère la valeur en JS), pas un
// vrai DEFAULT SQL — sans id fourni ici, l'insert échouait silencieusement
// (contrainte NOT NULL), comme partout ailleurs dans le code (cf.
// lib/cloudSync.ts, qui fournit toujours un id explicite).
function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Prévient l'invité par email qu'un partage l'attend — best-effort, ne doit
 * jamais faire échouer l'invitation elle-même (la ligne horse_collaborators
 * existe déjà) : un échec réseau/Resend retarde juste la découverte du
 * partage jusqu'à ce que l'invité ouvre l'app avec le même email. */
async function notifyInvitee(horseName: string, invitedEmail: string, role: CollaboratorRole): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/horse-invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ horseName, invitedEmail, role }),
    });
  } catch {
    // best-effort, cf. commentaire ci-dessus.
  }
}

export async function inviteCollaborator(
  horseId: string,
  email: string,
  role: CollaboratorRole,
  horseName: string
): Promise<boolean> {
  const invitedEmail = email.trim().toLowerCase();
  // `updatedAt` (`@updatedAt` côté Prisma) n'a pas non plus de vrai DEFAULT
  // SQL — même raison que `id` ci-dessus, à fournir explicitement.
  const { error } = await supabase.from("horse_collaborators").insert({
    id: generateId(),
    horseId,
    invitedEmail,
    role,
    updatedAt: new Date().toISOString(),
  });
  if (error) return false;
  notifyInvitee(horseName, invitedEmail, role);
  return true;
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
    .update({ status: "ACCEPTED", collaboratorUserId: userId, updatedAt: new Date().toISOString() })
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
