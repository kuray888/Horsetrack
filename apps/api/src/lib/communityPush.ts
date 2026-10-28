/**
 * Notifications du fil privé d'un cheval — logique pure, testée
 * (communityPush.test.ts). Envoi : Expo Push (gratuit), cf.
 * app/api/community/notify.
 */

export type PushRecipient = { token: string; userId: string; lang: string };

/** Un jeton Expo valide, et rien d'autre : jamais une adresse arbitraire. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(token);
}

/** Les participants du fil (propriétaire et partages acceptés), sauf
 * l'auteur, sans doublon. */
export function threadParticipants(ownerUserId: string | null, collaboratorUserIds: (string | null)[], authorUserId: string): string[] {
  const all = [ownerUserId, ...collaboratorUserIds].filter((u): u is string => !!u && u !== authorUserId);
  return [...new Set(all)];
}

/** Au plus 30 notifications de commentaire par auteur et par heure. */
export const MAX_NOTIFIED_COMMENTS_PER_HOUR = 30;

const preview = (body: string) => {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 89)}…` : flat;
};

export function commentPushMessages(input: {
  recipients: PushRecipient[];
  horseId: string;
  horseName: string;
  targetType: "session" | "journal";
  targetId: string;
  body: string;
}) {
  const url = `/comments?horseId=${encodeURIComponent(input.horseId)}&targetType=${input.targetType}&targetId=${encodeURIComponent(input.targetId)}`;
  return input.recipients
    .filter((r) => isExpoPushToken(r.token))
    .map((r) => {
      const en = r.lang === "en";
      const title = en
        ? `New comment on ${input.horseName}'s ${input.targetType === "session" ? "session" : "memory"}`
        : `Nouveau commentaire sur ${input.targetType === "session" ? "la séance" : "le souvenir"} de ${input.horseName}`;
      return { to: r.token, title, body: preview(input.body), sound: "default" as const, data: { url } };
    });
}
