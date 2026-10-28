import { NextRequest, NextResponse } from "next/server";
import { Prisma, db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { QUOTAS } from "@/lib/coach/config";
import { summaryRequestSchema } from "@/lib/coach/schemas";
import { canAccessHorse, coachAvailable, isPremiumUser, monthStart } from "@/lib/coach/store";

/**
 * Résumé du mois écoulé (Premium). L'app envoie les faits du mois, le
 * résumé est calculé en lot (Batch API, moitié prix) par
 * /api/cron/coach-summaries, puis relu par l'app (GET).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = summaryRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const body = parsed.data;

  if (!(await isPremiumUser(userId))) return NextResponse.json({ status: "premium" }, { status: 403 });
  if (!(await canAccessHorse(userId, body.horseId))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Seulement un mois terminé.
  const current = new Date().toISOString().slice(0, 7);
  if (body.month >= current) return NextResponse.json({ error: "Mois en cours" }, { status: 400 });

  const existing = await db.coachSummary.findUnique({
    where: { userId_horseId_month: { userId, horseId: body.horseId, month: body.month } },
  });
  if (existing) return NextResponse.json({ status: existing.status, summary: existing.summary });

  if (!(await coachAvailable())) return NextResponse.json({ status: "unavailable" });

  const thisMonth = await db.coachSummary.count({ where: { userId, createdAt: { gte: monthStart() } } });
  if (thisMonth >= QUOTAS.summaryHorsesPerMonth) return NextResponse.json({ status: "quota" });

  try {
    await db.coachSummary.create({
      data: { userId, horseId: body.horseId, month: body.month, lang: body.lang, facts: body.facts as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return NextResponse.json({ status: "PENDING", summary: null });
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const horseId = req.nextUrl.searchParams.get("horseId") ?? "";
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!horseId || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const row = await db.coachSummary.findUnique({ where: { userId_horseId_month: { userId, horseId, month } } });
  return NextResponse.json(row ? { status: row.status, summary: row.summary } : { status: "NONE", summary: null });
}
