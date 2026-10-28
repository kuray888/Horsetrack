import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { QUOTAS } from "@/lib/coach/config";
import { runQuestion } from "@/lib/coach/engine";
import { mentionsSymptom, vetMessage } from "@/lib/coach/safety";
import { questionRequestSchema } from "@/lib/coach/schemas";
import { coachAvailable, isPremiumUser, logCall, questionsUsedThisMonth } from "@/lib/coach/store";

/**
 * « Pose une question sur ton cheval » (Premium, 30 par mois). Réponses tirées
 * uniquement du carnet envoyé par l'app. Un symptôme ou une demande de soin
 * reçoit « appelle ton vétérinaire », sans appel au modèle ni quota consommé.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = questionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const body = parsed.data;

  if (!(await isPremiumUser(userId))) return NextResponse.json({ status: "premium" }, { status: 403 });

  // Avant tout le reste : même coach coupé, un symptôme mène au vétérinaire.
  if (mentionsSymptom(body.question)) {
    await logCall({ userId, kind: "question", status: "medical", usage: null, costUsd: 0 });
    return NextResponse.json({ status: "ok", answer: vetMessage(body.lang), found: false, medical: true });
  }

  if (!(await coachAvailable())) return NextResponse.json({ status: "unavailable" });

  const used = await questionsUsedThisMonth(userId);
  if (used >= QUOTAS.questionsPerMonth) {
    return NextResponse.json({ status: "quota", questionsLeft: 0 }, { status: 429 });
  }

  const result = await runQuestion(new Anthropic(), body);
  await logCall({
    userId,
    kind: "question",
    status: result.outcome,
    usage: result.usage,
    costUsd: result.costUsd,
    errorCode: result.errors.join(",").slice(0, 200) || null,
  });
  if (result.outcome === "error") return NextResponse.json({ status: "unavailable" });

  const counted = result.outcome !== "medical";
  return NextResponse.json({
    status: "ok",
    ...result.value,
    questionsLeft: Math.max(0, QUOTAS.questionsPerMonth - used - (counted ? 1 : 0)),
  });
}
