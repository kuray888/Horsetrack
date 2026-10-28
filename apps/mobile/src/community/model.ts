import { t } from "@/i18n";

/**
 * Fil privé d'un cheval — logique pure, testée (model.test.ts). Pas de
 * réseau social public : seulement le propriétaire et les personnes avec
 * qui le cheval est partagé (RLS can_access_horse, cf. bloc-c-2026-10-28.sql).
 */

export type TargetType = "session" | "journal";
export type AuthorRole = "OWNER" | "DEMI_PENSION" | "COACH" | "RIDER" | "GROOM";

export type Comment = {
  id: string;
  horseId: string;
  authorUserId: string;
  authorRole: AuthorRole;
  targetType: TargetType;
  targetId: string;
  body: string;
  createdAt: Date;
};

export type Reaction = { id: string; userId: string; emoji: Emoji; targetType: TargetType; targetId: string };

/** Liste fermée (vérifiée aussi par la base). */
export const EMOJIS = ["👏", "❤️", "💪", "😂", "😮"] as const;
export type Emoji = (typeof EMOJIS)[number];

export const COMMENT_MAX = 1000;

/** Texte prêt à envoyer, ou null (vide ou trop long). */
export function cleanCommentBody(text: string): string | null {
  const body = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return body.length >= 1 && body.length <= COMMENT_MAX ? body : null;
}

export function generateCommentId(): string {
  return `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE: Record<AuthorRole, string> = {
  OWNER: t("Propriétaire"),
  DEMI_PENSION: t("Demi-pension"),
  COACH: t("Coach"),
  RIDER: t("Cavalier·ère"),
  GROOM: t("Groom"),
};

/** « Toi », sinon le rôle : les participants se connaissent, l'app n'affiche
 * ni email ni nom de compte. */
export function authorLabel(c: Pick<Comment, "authorUserId" | "authorRole">, myUserId: string | null): string {
  return c.authorUserId === myUserId ? t("Toi") : (ROLE[c.authorRole] ?? ROLE.RIDER);
}

/** Suppression : son propre commentaire, ou n'importe lequel pour le
 * propriétaire du cheval (modération de son fil). */
export function canDelete(c: Pick<Comment, "authorUserId">, myUserId: string | null, iOwnTheHorse: boolean): boolean {
  return c.authorUserId === myUserId || iOwnTheHorse;
}

/** Réactions regroupées, dans l'ordre de la liste, avec « la mienne ». */
export function reactionSummary(reactions: Reaction[], myUserId: string | null): { emoji: Emoji; count: number; mine: boolean }[] {
  return EMOJIS.map((emoji) => {
    const of = reactions.filter((r) => r.emoji === emoji);
    return { emoji, count: of.length, mine: of.some((r) => r.userId === myUserId) };
  });
}

/** « à l'instant », « il y a 5 min », « il y a 3 h », puis la date. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (min < 1) return t("à l'instant");
  if (min < 60) return t("il y a {n} min", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("il y a {n} h", { n: h });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
