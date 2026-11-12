import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { QUOTAS } from "@/lib/coach/config";
import { questionAllowance } from "@/lib/coach/allowance";
import { coachAccess, coachAvailable, questionsUsedEver, questionsUsedThisMonth } from "@/lib/coach/store";

/** État du coach pour l'app : en service ?, Premium ?, questions restantes. */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const [available, quotas, used, usedEver] = await Promise.all([
    coachAvailable(),
    coachAccess(userId),
    questionsUsedThisMonth(userId),
    questionsUsedEver(userId),
  ]);
  // Compte gratuit : questions offertes restantes (null pour un Premium).
  const free = quotas ? null : questionAllowance({ quotas: null, usedThisMonth: used, usedEver }).left;
  // Sans Premium, la limite affichée reste celle de Premium (ce que l'offre ouvrirait).
  const limit = (quotas ?? QUOTAS).questionsPerMonth;
  const summaryLimit = (quotas ?? QUOTAS).summaryHorsesPerMonth;
  return NextResponse.json({
    available,
    premium: quotas !== null,
    questionsLimit: limit,
    // Chevaux dont le résumé du mois peut être demandé (l'app ne l'écrit plus en dur).
    summaryHorsesPerMonth: summaryLimit,
    questionsLeft: Math.max(0, limit - used),
    freeQuestionsLeft: free,
  });
}
