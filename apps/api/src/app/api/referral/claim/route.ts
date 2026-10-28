import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, SubscriptionStatus, db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { claimRefusal, isReferralCodeFormat, normalizeReferralCode } from "@/lib/referrals";

const schema = z.object({ code: z.string().min(1).max(20) });

/** Saisie du code d'un ami par un nouveau compte (cf. lib/referrals.ts). */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ result: "invalid" }, { status: 400 });
  const code = normalizeReferralCode(parsed.data.code);
  if (!isReferralCodeFormat(code)) return NextResponse.json({ result: "invalid" });

  const owner = await db.referralCode.findUnique({ where: { code } });
  if (!owner) return NextResponse.json({ result: "invalid" });

  const [user, existing, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    db.referralUse.findUnique({ where: { refereeUserId: userId } }),
    db.riderProfile.findUnique({ where: { userId }, select: { subscriptionStatus: true } }),
  ]);
  if (!user) return NextResponse.json({ result: "invalid" });

  const refusal = claimRefusal({
    refereeUserId: userId,
    referrerUserId: owner.userId,
    refereeCreatedAt: user.createdAt,
    alreadyReferred: !!existing,
    // Un essai en cours n'est pas un abonnement payé : il peut encore parrainer.
    everSubscribed: profile?.subscriptionStatus === SubscriptionStatus.ACTIVE,
    now: new Date(),
  });
  if (refusal) return NextResponse.json({ result: refusal });

  try {
    await db.referralUse.create({ data: { refereeUserId: userId, referrerUserId: owner.userId, code } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ result: "already_referred" });
    }
    throw e;
  }
  return NextResponse.json({ result: "ok" });
}
