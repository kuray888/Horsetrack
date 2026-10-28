import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, db } from "@cheval/db";
import { coachEnabled, monthlyBudgetUsd } from "@/lib/coach/config";
import { estimateCostUsd, type CoachUsage } from "@/lib/coach/cost";
import { readSummaryResult, summaryBatchRequest } from "@/lib/coach/engine";
import { logCall, monthSpendUsd } from "@/lib/coach/store";

/**
 * Résumés du mois en lot (Batch API, moitié prix), toutes les 15 minutes
 * avec les autres tâches (cf. .github/workflows/email-reminders-cron.yml) :
 * 1. relève les lots terminés et enregistre les résumés (les faits envoyés
 *    sont alors effacés) ;
 * 2. envoie en un lot les demandes en attente.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!coachEnabled()) return NextResponse.json({ skipped: "coach_disabled" });

  const client = new Anthropic();
  let collected = 0;
  let submitted = 0;

  // 1. Lots envoyés : terminés ?
  const batchIds = await db.coachSummary.findMany({
    where: { status: "SUBMITTED", batchId: { not: null } },
    distinct: ["batchId"],
    select: { batchId: true },
    take: 20,
  });
  for (const { batchId } of batchIds) {
    const batch = await client.messages.batches.retrieve(batchId!);
    if (batch.processing_status !== "ended") continue;
    const rows = await db.coachSummary.findMany({ where: { batchId }, select: { id: true, userId: true } });
    const userOf = new Map(rows.map((r) => [r.id, r.userId]));
    const seen = new Set<string>();
    for await (const result of await client.messages.batches.results(batchId!)) {
      const userId = userOf.get(result.custom_id);
      if (!userId) continue;
      seen.add(result.custom_id);
      if (result.result.type === "succeeded") {
        const message = result.result.message;
        const usage = message.usage as CoachUsage;
        const checked = readSummaryResult(message);
        await db.coachSummary.update({
          where: { id: result.custom_id },
          data: checked.ok
            ? { status: "DONE", summary: checked.value, facts: Prisma.DbNull }
            : { status: "FAILED", facts: Prisma.DbNull },
        });
        await logCall({
          userId,
          kind: "summary",
          status: checked.ok ? "ok" : "fallback",
          usage,
          costUsd: estimateCostUsd(usage, true),
          errorCode: checked.ok ? null : checked.errors.join(","),
        });
      } else {
        // Erreur ou expiration : remis en attente pour le prochain lot.
        await db.coachSummary.update({ where: { id: result.custom_id }, data: { status: "PENDING", batchId: null } });
      }
      collected++;
    }
    // Lignes absentes des résultats : remises en attente.
    const missing = rows.filter((r) => !seen.has(r.id)).map((r) => r.id);
    if (missing.length) {
      await db.coachSummary.updateMany({ where: { id: { in: missing } }, data: { status: "PENDING", batchId: null } });
    }
  }

  // 2. Demandes en attente : un lot, si le plafond du mois le permet.
  if ((await monthSpendUsd()) < monthlyBudgetUsd()) {
    const pending = await db.coachSummary.findMany({ where: { status: "PENDING" }, take: 500, orderBy: { createdAt: "asc" } });
    const ready = pending.filter((p) => p.facts && typeof p.facts === "object");
    if (ready.length) {
      const batch = await client.messages.batches.create({
        requests: ready.map((p) => summaryBatchRequest(p.id, p.lang === "en" ? "en" : "fr", p.facts as Record<string, unknown>)),
      });
      await db.coachSummary.updateMany({ where: { id: { in: ready.map((p) => p.id) } }, data: { status: "SUBMITTED", batchId: batch.id } });
      submitted = ready.length;
    }
  }

  return NextResponse.json({ collected, submitted });
}
