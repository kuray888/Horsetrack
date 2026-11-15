import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { runQuestion } from "@/lib/coach/engine";
import { mentionsSymptom, vetMessage } from "@/lib/coach/safety";
import { questionRequestSchema } from "@/lib/coach/schemas";
import { questionAllowance } from "@/lib/coach/allowance";
import { coachAvailable, coachAccess, hasCoachConsent, logCall, questionsUsedEver, questionsUsedThisMonth, reserveQuestion, settleQuestion } from "@/lib/coach/store";

/**
 * « Pose une question sur ton cheval » (Premium, 30 par mois ; un compte
 * gratuit a 3 questions offertes en tout, cf. coach/allowance.ts). Réponses tirées
 * uniquement du carnet envoyé par l'app. Un symptôme ou une demande de soin
 * reçoit « appelle ton vétérinaire », sans appel au modèle ni quota consommé.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = questionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const body = parsed.data;

  // Accord pour l'IA : exigé ici aussi, pas seulement dans l'app (428 : l'app
  // renvoie l'accord déjà donné sur l'appareil, puis réessaie).
  if (!(await hasCoachConsent(userId))) return NextResponse.json({ status: "consent" }, { status: 428 });

  const quotas = await coachAccess(userId);
  const [usedThisMonth, usedEver] = await Promise.all([
    questionsUsedThisMonth(userId),
    quotas ? Promise.resolve(0) : questionsUsedEver(userId),
  ]);
  const allowance = questionAllowance({ quotas, usedThisMonth, usedEver });
  // Compte gratuit sans question offerte restante : l'app ouvre le paywall.
  if (allowance.free && !allowance.allowed) return NextResponse.json({ status: "premium" }, { status: 403 });

  // Avant tout le reste : même coach coupé, un symptôme mène au vétérinaire.
  if (mentionsSymptom(body.question)) {
    await logCall({ userId, kind: "question", status: "medical", usage: null, costUsd: 0 });
    return NextResponse.json({ status: "ok", answer: vetMessage(body.lang), found: false, medical: true });
  }

  if (!(await coachAvailable())) return NextResponse.json({ status: "unavailable" });

  if (!allowance.allowed) return NextResponse.json({ status: "quota", questionsLeft: 0 }, { status: 429 });

  // Réservation sous verrou : des requêtes simultanées ne dépassent plus le
  // quota (cf. reserveQuestion).
  const reservation = await reserveQuestion(userId, quotas);
  if (!reservation.reservationId) return NextResponse.json({ status: "quota", questionsLeft: 0 }, { status: 429 });

  let result;
  try {
    result = await runQuestion(new Anthropic(), body);
  } catch (e) {
    await settleQuestion(reservation.reservationId, { status: "error", usage: null, costUsd: 0, errorCode: "exception" });
    throw e;
  }
  await settleQuestion(reservation.reservationId, {
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
    questionsLeft: Math.max(0, reservation.allowance.left - (counted ? 1 : 0)),
    freeQuestions: allowance.free,
  });
}
