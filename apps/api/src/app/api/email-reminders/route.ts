import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, SubscriptionStatus } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

const schema = z.object({
  sendAt: z.string().datetime(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

/**
 * Crée un rappel email programmé pour un rendez-vous d'agenda (l'agenda
 * lui-même reste local-first sur mobile, cf. agenda/store.tsx — ceci ne
 * stocke que le strict nécessaire pour pouvoir envoyer l'email plus tard,
 * cf. /api/cron/email-reminders). Réservé aux comptes abonnés/en essai —
 * plus de palier Free depuis le pivot tarifaire du 2026-09-03, cf.
 * rls.sql rider_is_active_or_trialing pour l'équivalent RLS.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });
  const isActiveOrTrialing =
    !!riderProfile &&
    (riderProfile.subscriptionStatus === SubscriptionStatus.ACTIVE ||
      (riderProfile.subscriptionStatus === SubscriptionStatus.TRIALING &&
        !!riderProfile.trialEndsAt &&
        riderProfile.trialEndsAt > new Date()));
  if (!isActiveOrTrialing) {
    return NextResponse.json({ error: "Les rappels automatiques sont réservés aux comptes abonnés." }, { status: 403 });
  }

  const reminder = await db.emailReminder.create({
    data: { userId, sendAt: new Date(parsed.data.sendAt), subject: parsed.data.subject, body: parsed.data.body },
    select: { id: true },
  });

  return NextResponse.json({ id: reminder.id });
}
