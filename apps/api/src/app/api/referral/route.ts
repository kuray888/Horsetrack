import { NextRequest, NextResponse } from "next/server";
import { Prisma, db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { CLAIM_WINDOW_DAYS, generateReferralCode } from "@/lib/referrals";

/**
 * Mon parrainage : mon code (créé à la première demande), le nombre d'amis
 * inscrits avec, le nombre de mois offerts gagnés, et si je peux encore
 * saisir le code d'un ami (cf. lib/referrals.ts).
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let row = await db.referralCode.findUnique({ where: { userId } });
  for (let attempt = 0; !row && attempt < 5; attempt++) {
    try {
      row = await db.referralCode.create({ data: { userId, code: generateReferralCode() } });
    } catch (e) {
      // Code déjà pris (collision rare) : on en tire un autre.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      row = await db.referralCode.findUnique({ where: { userId } });
    }
  }
  if (!row) return NextResponse.json({ error: "Code indisponible" }, { status: 503 });

  const [invited, rewarded, mine, user] = await Promise.all([
    db.referralUse.count({ where: { referrerUserId: userId } }),
    db.referralUse.count({ where: { referrerUserId: userId, rewardedAt: { not: null } } }),
    db.referralUse.findUnique({ where: { refereeUserId: userId }, select: { code: true } }),
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  const ageDays = user ? (Date.now() - user.createdAt.getTime()) / 86_400_000 : Infinity;

  return NextResponse.json({
    code: row.code,
    invited,
    rewarded,
    referredBy: mine?.code ?? null,
    canClaim: !mine && ageDays <= CLAIM_WINDOW_DAYS,
  });
}
