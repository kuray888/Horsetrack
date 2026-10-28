import { randomBytes } from "node:crypto";
import { z } from "zod";
import { safeLine } from "@/lib/emailSafety";

/**
 * Sécurité en balade (Premium) — règles pures, testées (rideSafety.test.ts).
 * Routes : /api/ride-safety (départ), /api/ride-safety/[token] (position,
 * alerte, fin), page publique /suivi/[token], cron /api/cron/ride-safety.
 *
 * Principe : l'app envoie sa dernière position toutes les minutes. Elle
 * détecte elle-même un cavalier immobile (cf. apps/mobile/src/rides/safety.ts)
 * et déclenche l'alerte ; le serveur, lui, s'inquiète d'un téléphone devenu
 * muet (batterie, chute, réseau) : c'est le seul cas que l'app ne peut pas
 * signaler.
 */

export const MAX_CONTACTS = 3;
/** Départs par compte et par 24 h : borne les emails qu'un compte déclenche. */
export const MAX_STARTS_PER_DAY = 6;
/** Sans position depuis ce délai, les proches sont prévenus. */
export const STALE_AFTER_MS = 15 * 60_000;
/** Une balade oubliée (app jamais arrêtée) se clôt d'elle-même. */
export const AUTO_END_AFTER_MS = 12 * 60 * 60_000;
/** Deux alertes « immobile » d'un même partage : au moins ce délai entre elles. */
export const ALERT_COOLDOWN_MS = 10 * 60_000;
/** Lien de suivi encore lisible après la fin, puis la ligne est purgée. */
export const VIEW_AFTER_END_MS = 24 * 60 * 60_000;
export const PURGE_AFTER_END_MS = 7 * 24 * 60 * 60_000;

export type ShareStatus = "ACTIVE" | "ALERT" | "ENDED";

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
});

export const startSchema = z.object({
  riderName: z.string().trim().min(1).max(60),
  horseName: z.string().trim().min(1).max(60),
  contacts: z.array(contactSchema).min(1).max(MAX_CONTACTS),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("position"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(10_000).nullable().optional(),
  }),
  z.object({
    action: z.literal("alert"),
    reason: z.enum(["immobile", "manual"]),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }),
  z.object({ action: z.literal("end") }),
]);

export type Contact = z.infer<typeof contactSchema>;

/** Adresse publique du lien de suivi : celle de l'API qui répond, sauf
 * réglage explicite (PUBLIC_BASE_URL, pour un domaine personnalisé). */
export function publicBaseUrl(requestUrl: string): string {
  return (process.env.PUBLIC_BASE_URL || new URL(requestUrl).origin).replace(/\/$/, "");
}

/** Jeton du lien de suivi : 24 octets aléatoires, non devinable. */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function isShareToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(value);
}

export function parseContacts(value: unknown): Contact[] {
  const parsed = z.array(contactSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

type ShareTimes = {
  status: string;
  startedAt: Date;
  lastPointAt: Date | null;
  alertSentAt: Date | null;
  staleAlertSentAt: Date | null;
  endedAt: Date | null;
};

/** Faut-il prévenir les proches d'un silence du téléphone ? Une fois par
 * silence : un nouveau point reçu depuis la dernière alerte en réarme une. */
export function needsStaleAlert(share: ShareTimes, now: Date): boolean {
  if (share.status === "ENDED") return false;
  const last = share.lastPointAt ?? share.startedAt;
  if (now.getTime() - last.getTime() < STALE_AFTER_MS) return false;
  return !share.staleAlertSentAt || share.staleAlertSentAt < last;
}

export function shouldAutoEnd(share: ShareTimes, now: Date): boolean {
  return share.status !== "ENDED" && now.getTime() - share.startedAt.getTime() >= AUTO_END_AFTER_MS;
}

export function canSendAlert(share: ShareTimes, now: Date): boolean {
  if (share.status === "ENDED") return false;
  return !share.alertSentAt || now.getTime() - share.alertSentAt.getTime() >= ALERT_COOLDOWN_MS;
}

/** Le lien de suivi montre-t-il encore la position ? */
export function isViewable(share: ShareTimes, now: Date): boolean {
  return !share.endedAt || now.getTime() - share.endedAt.getTime() < VIEW_AFTER_END_MS;
}

export function mapsLinks(lat: number, lng: number): { apple: string; google: string } {
  const q = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return { apple: `https://maps.apple.com/?q=${q}`, google: `https://www.google.com/maps/search/?api=1&query=${q}` };
}

/** Heure de Paris (« 14:05 ») : les proches lisent l'email en France. */
export function parisTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(d);
}

export function minutesAgo(d: Date, now: Date): string {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h ${String(m % 60).padStart(2, "0")}`;
}

type EmailContext = { riderName: string; horseName: string; viewUrl: string };
export type Email = { subject: string; body: string };

function names(ctx: EmailContext) {
  return { rider: safeLine(ctx.riderName, 60), horse: safeLine(ctx.horseName, 60) };
}

const FOOTER =
  "\n\n—\nVous recevez cet email parce que ce cavalier vous a choisi comme contact de sécurité dans l'app Horsetrack. Ce lien de suivi expire 24 h après la fin de la balade.";

export function startEmail(ctx: EmailContext): Email {
  const { rider, horse } = names(ctx);
  return {
    subject: `${rider} part à cheval et partage sa position avec vous`,
    body:
      `${rider} vient de commencer une séance avec ${horse} et vous a choisi comme contact de sécurité.\n\n` +
      `Suivre sa position en direct :\n${ctx.viewUrl}\n\n` +
      `Vous n'avez rien à faire. Si ${rider} ne bouge plus pendant plusieurs minutes, ou si son téléphone ne donne plus de nouvelles, vous recevrez un autre email.` +
      FOOTER,
  };
}

export function alertEmail(
  ctx: EmailContext & { reason: "immobile" | "manual"; lat: number | null; lng: number | null; at: Date | null }
): Email {
  const { rider, horse } = names(ctx);
  const where =
    ctx.lat !== null && ctx.lng !== null
      ? `Dernière position connue${ctx.at ? ` (${parisTime(ctx.at)})` : ""} :\n${mapsLinks(ctx.lat, ctx.lng).google}\n\n`
      : "";
  const what =
    ctx.reason === "manual"
      ? `${rider} a demandé de l'aide depuis l'app pendant sa séance avec ${horse}.`
      : `${rider} ne bouge plus depuis plus de 5 minutes pendant sa séance avec ${horse}, et n'a pas répondu à la vérification de l'app.`;
  return {
    subject: `Alerte : ${rider} a peut-être besoin d'aide`,
    body:
      `${what}\n\nEssayez de l'appeler. Sans réponse, rendez-vous sur place ou appelez les secours (112).\n\n` +
      where +
      `Suivi en direct :\n${ctx.viewUrl}` +
      FOOTER,
  };
}

export function staleEmail(ctx: EmailContext & { lat: number | null; lng: number | null; lastAt: Date }): Email {
  const { rider, horse } = names(ctx);
  const where =
    ctx.lat !== null && ctx.lng !== null ? `Dernière position connue :\n${mapsLinks(ctx.lat, ctx.lng).google}\n\n` : "";
  return {
    subject: `Pas de nouvelles du téléphone de ${rider} depuis 15 minutes`,
    body:
      `Le téléphone de ${rider} n'envoie plus sa position depuis ${parisTime(ctx.lastAt)}, pendant sa séance avec ${horse}. ` +
      `Ce peut être une simple perte de réseau ou une batterie vide.\n\nEssayez de l'appeler pour vous rassurer.\n\n` +
      where +
      `Suivi :\n${ctx.viewUrl}` +
      FOOTER,
  };
}

export function allClearEmail(ctx: EmailContext): Email {
  const { rider, horse } = names(ctx);
  return {
    subject: `${rider} a terminé sa séance`,
    body: `Bonne nouvelle : ${rider} a terminé sa séance avec ${horse} depuis l'app. Le suivi est terminé.` + FOOTER,
  };
}
