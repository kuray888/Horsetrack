import { db } from "@cheval/db";
import { isPremiumNow } from "@/lib/promoRules";
import { COACH_MODEL, coachEnabled, monthlyBudgetUsd } from "@/lib/coach/config";
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
