import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { QUOTAS } from "@/lib/coach/config";
import { coachAccess, coachAvailable, questionsUsedThisMonth } from "@/lib/coach/store";

/** État du coach pour l'app : en service ?, Premium ?, questions restantes. */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const [available, quotas, used] = await Promise.all([coachAvailable(), coachAccess(userId), questionsUsedThisMonth(userId)]);
  // Sans Premium, la limite affichée reste celle de Premium (ce que l'offre ouvrirait).
  const limit = (quotas ?? QUOTAS).questionsPerMonth;
  return NextResponse.json({
    available,
    premium: quotas !== null,
    questionsLimit: limit,
    questionsLeft: Math.max(0, limit - used),
  });
}
