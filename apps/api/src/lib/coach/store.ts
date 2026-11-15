import { db } from "@cheval/db";
import { isPremiumNow } from "@/lib/promoRules";
import { COACH_MODEL, coachEnabled, monthlyBudgetUsd, quotasForTier, type CoachQuotas } from "@/lib/coach/config";
import { questionAllowance } from "@/lib/coach/allowance";
import { toMicros, type CoachUsage } from "@/lib/coach/cost";

/**
 * Accès base du coach : droits, quotas, plafond de dépense et journal des
 * appels. Le journal ne garde que des compteurs (tokens, coût, issue),
 * jamais une question, une réponse ou un fait du cheval.
 */

export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const rider = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });
  return !!rider && isPremiumNow(rider, new Date());
}

/** Quotas du coach pour ce compte, ou null s'il n'a pas Premium (ni Pro). */
export async function coachAccess(userId: string): Promise<CoachQuotas | null> {
  const rider = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionStatus: true, trialEndsAt: true, subscriptionTier: true },
  });
  if (!rider || !isPremiumNow(rider, new Date())) return null;
  return quotasForTier(rider.subscriptionTier);
}

/** L'utilisateur a-t-il accepté l'envoi de son carnet à l'IA ? Sans accord
 * enregistré, aucune route du coach n'appelle le modèle (guideline 5.1.2(i)) :
 * l'app le vérifie aussi, mais le serveur ne doit pas lui faire confiance. */
export async function hasCoachConsent(userId: string): Promise<boolean> {
  const rider = await db.riderProfile.findUnique({ where: { userId }, select: { coachConsentAt: true } });
  return !!rider?.coachConsentAt;
}

/** Enregistre (ou retire) l'accord. Retourne false sans profil cavalier. */
export async function setCoachConsent(userId: string, granted: boolean): Promise<boolean> {
  const { count } = await db.riderProfile.updateMany({
    where: { userId },
    data: { coachConsentAt: granted ? new Date() : null },
  });
  return count > 0;
}

/** Le cheval appartient au compte, ou lui est partagé (accepté). */
export async function canAccessHorse(userId: string, horseId: string): Promise<boolean> {
  const horse = await db.horse.findFirst({
    where: {
      id: horseId,
      OR: [
        { owner: { userId } },
        { collaborators: { some: { collaboratorUserId: userId, status: "ACCEPTED" } } },
      ],
    },
    select: { id: true },
  });
  return !!horse;
}

export async function monthSpendUsd(now: Date = new Date()): Promise<number> {
  const sum = await db.coachCall.aggregate({ _sum: { costMicros: true }, where: { createdAt: { gte: monthStart(now) } } });
  return (sum._sum.costMicros ?? 0) / 1_000_000;
}

/** Coach en service : interrupteur ouvert et plafond du mois pas atteint. */
export async function coachAvailable(): Promise<boolean> {
  if (!coachEnabled()) return false;
  return (await monthSpendUsd()) < monthlyBudgetUsd();
}

/** Questions qui ont coûté un appel ce mois-ci (le renvoi vers le
 * vétérinaire, fait sans le modèle, ne compte pas). */
export async function questionsUsedThisMonth(userId: string): Promise<number> {
  return db.coachCall.count({
    where: { userId, kind: "question", status: { in: ["ok", "fallback", "refusal"] }, createdAt: { gte: monthStart() } },
  });
}

/** Toutes les questions qui ont coûté un appel, depuis toujours : décompte des
 * questions offertes à un compte gratuit (cf. coach/allowance.ts). */
export async function questionsUsedEver(userId: string): Promise<number> {
  return db.coachCall.count({ where: { userId, kind: "question", status: { in: ["ok", "fallback", "refusal"] } } });
}

export async function logCall(input: {
  userId: string;
  kind: "suggestion" | "question" | "summary";
  status: string;
  usage: CoachUsage | null;
  costUsd: number;
  errorCode?: string | null;
}): Promise<void> {
  await db.coachCall
    .create({
      data: {
        userId: input.userId,
        kind: input.kind,
        model: COACH_MODEL,
        status: input.status,
        inputTokens: input.usage?.input_tokens ?? 0,
        outputTokens: input.usage?.output_tokens ?? 0,
        cacheReadTokens: input.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: input.usage?.cache_creation_input_tokens ?? 0,
        costMicros: toMicros(input.costUsd),
        errorCode: input.errorCode ?? null,
      },
    })
    .catch((e) => console.warn("[coach] journal impossible", e));
}

/** Une réservation « pending » vieille de plus de ce délai (appel planté) ne
 * compte plus dans le quota. */
const PENDING_TTL_MS = 3 * 60_000;

/**
 * Réserve une question AVANT l'appel au modèle. Le quota était lu puis écrit
 * après l'appel : 10 requêtes parallèles voyaient toutes le même compteur et
 * coûtaient 10 appels. Ici la lecture et la réservation se font sous un verrou
 * par compte, dans une transaction : la requête suivante voit la précédente.
 * `reservationId` est null quand le quota est épuisé.
 */
export async function reserveQuestion(
  userId: string,
  quotas: CoachQuotas | null,
  now: Date = new Date()
): Promise<{ allowance: ReturnType<typeof questionAllowance>; reservationId: string | null }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${"coach_question:" + userId}, 0))`;
    const counted = {
      userId,
      kind: "question",
      OR: [
        { status: { in: ["ok", "fallback", "refusal"] } },
        { status: "pending", createdAt: { gte: new Date(now.getTime() - PENDING_TTL_MS) } },
      ],
    };
    const [usedThisMonth, usedEver] = await Promise.all([
      tx.coachCall.count({ where: { ...counted, createdAt: { gte: monthStart(now) } } }),
      quotas ? Promise.resolve(0) : tx.coachCall.count({ where: counted }),
    ]);
    const allowance = questionAllowance({ quotas, usedThisMonth, usedEver });
    if (!allowance.allowed) return { allowance, reservationId: null };
    const row = await tx.coachCall.create({
      data: { userId, kind: "question", model: COACH_MODEL, status: "pending" },
      select: { id: true },
    });
    return { allowance, reservationId: row.id };
  });
}

/** Clôt une réservation avec l'issue réelle de l'appel (cf. reserveQuestion). */
export async function settleQuestion(
  reservationId: string,
  input: { status: string; usage: CoachUsage | null; costUsd: number; errorCode?: string | null }
): Promise<void> {
  await db.coachCall
    .update({
      where: { id: reservationId },
      data: {
        status: input.status,
        inputTokens: input.usage?.input_tokens ?? 0,
        outputTokens: input.usage?.output_tokens ?? 0,
        cacheReadTokens: input.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: input.usage?.cache_creation_input_tokens ?? 0,
        costMicros: toMicros(input.costUsd),
        errorCode: input.errorCode ?? null,
      },
    })
    .catch((e) => console.warn("[coach] clôture de la réservation impossible", e));
}
