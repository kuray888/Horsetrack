import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { QUOTAS } from "@/lib/coach/config";
import { coachAvailable, isPremiumUser, questionsUsedThisMonth } from "@/lib/coach/store";

/** État du coach pour l'app : en service ?, Premium ?, questions restantes. */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const [available, premium, used] = await Promise.all([coachAvailable(), isPremiumUser(userId), questionsUsedThisMonth(userId)]);
  return NextResponse.json({
    available,
    premium,
    questionsLimit: QUOTAS.questionsPerMonth,
    questionsLeft: Math.max(0, QUOTAS.questionsPerMonth - used),
  });
}
