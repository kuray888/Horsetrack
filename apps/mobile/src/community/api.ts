import { supabase } from "@/lib/supabase";
import { listCollaborators } from "@/lib/sharing";
import { generateCommentId, type AuthorRole, type Comment, type Emoji, type Reaction, type TargetType } from "@/community/model";

/**
 * Fil privé d'un cheval, côté app : lu et écrit directement dans Supabase
 * (RLS can_access_horse : seuls le propriétaire et les partages acceptés y
 * ont accès). En ligne seulement — une conversation ne se rejoue pas plus
 * tard. Les notifications passent par l'API (/api/community/notify).
 */

type CommentRow = {
  id: string;
  horseId: string;
  authorUserId: string;
  authorRole: string;
  targetType: string;
  targetId: string;
  body: string;
  createdAt: string;
};

const toComment = (r: CommentRow): Comment => ({
  ...r,
  authorRole: r.authorRole as AuthorRole,
  targetType: r.targetType as TargetType,
  createdAt: new Date(r.createdAt),
});

export async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function fetchThread(
  horseId: string,
  targetType: TargetType,
  targetId: string
): Promise<{ comments: Comment[]; reactions: Reaction[] } | null> {
  const [c, r] = await Promise.all([
    supabase
      .from("horse_comments")
      .select("id, horseId, authorUserId, authorRole, targetType, targetId, body, createdAt")
      .eq("horseId", horseId)
      .eq("targetType", targetType)
      .eq("targetId", targetId)
      .order("createdAt", { ascending: true })
      .limit(200),
    supabase
      .from("horse_reactions")
      .select("id, userId, emoji, targetType, targetId")
      .eq("horseId", horseId)
      .eq("targetType", targetType)
      .eq("targetId", targetId),
  ]);
  if (c.error || r.error || !c.data || !r.data) return null;
  return { comments: (c.data as CommentRow[]).map(toComment), reactions: r.data as Reaction[] };
}

/** Derniers échanges du cheval, toutes séances et souvenirs confondus. */
export async function fetchHorseFeed(horseId: string): Promise<Comment[] | null> {
  const { data, error } = await supabase
    .from("horse_comments")
    .select("id, horseId, authorUserId, authorRole, targetType, targetId, body, createdAt")
    .eq("horseId", horseId)
    .order("createdAt", { ascending: false })
    .limit(60);
  return error || !data ? null : (data as CommentRow[]).map(toComment);
}

/** Nombre de commentaires par cible, pour les boutons des cartes. */
export async function fetchCommentCounts(horseId: string): Promise<Map<string, number> | null> {
  const { data, error } = await supabase.from("horse_comments").select("targetId").eq("horseId", horseId).limit(2000);
  if (error || !data) return null;
  const counts = new Map<string, number>();
  for (const row of data as { targetId: string }[]) counts.set(row.targetId, (counts.get(row.targetId) ?? 0) + 1);
  return counts;
}

async function notify(commentId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/community/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ commentId }),
    });
  } catch {
    // Best-effort : le commentaire est enregistré, seule la notification manque.
  }
}

export async function postComment(horseId: string, targetType: TargetType, targetId: string, body: string): Promise<Comment | null> {
  const id = generateCommentId();
  // authorUserId et authorRole sont posés par la base (trigger), pas ici.
  const { data, error } = await supabase
    .from("horse_comments")
    .insert({ id, horseId, targetType, targetId, body, authorUserId: "", authorRole: "OWNER" })
    .select("id, horseId, authorUserId, authorRole, targetType, targetId, body, createdAt")
    .single();
  if (error || !data) return null;
  void notify(id);
  return toComment(data as CommentRow);
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase.from("horse_comments").delete().eq("id", id);
  return !error;
}

export async function reportComment(commentId: string, reason: string): Promise<boolean> {
  const userId = await myUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from("comment_reports")
    .insert({ id: `cr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, commentId, reporterUserId: userId, reason });
  // Déjà signalé par cette personne : c'est fait.
  return !error || error.code === "23505";
}

export async function toggleReaction(
  horseId: string,
  targetType: TargetType,
  targetId: string,
  emoji: Emoji,
  existing: Reaction | undefined
): Promise<boolean> {
  if (existing) {
    const { error } = await supabase.from("horse_reactions").delete().eq("id", existing.id);
    return !error;
  }
  const userId = await myUserId();
  if (!userId) return false;
  const { error } = await supabase.from("horse_reactions").insert({
    id: `rx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    horseId,
    userId,
    targetType,
    targetId,
    emoji,
  });
  return !error || error.code === "23505";
}

/** Un fil n'a de sens qu'à plusieurs : cheval partagé avec moi, ou que je
 * partage (au moins un partage accepté). Mis en cache le temps de la session. */
const sharedCache = new Map<string, boolean>();

export async function isHorseShared(horseId: string, sharedRole: string | null): Promise<boolean> {
  if (sharedRole) return true;
  const known = sharedCache.get(horseId);
  if (known !== undefined) return known;
  const list = await listCollaborators(horseId);
  if (!list) return false;
  const shared = list.some((c) => c.status === "ACCEPTED");
  sharedCache.set(horseId, shared);
  return shared;
}
