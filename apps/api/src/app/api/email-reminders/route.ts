import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, SubscriptionStatus } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { safeBlock, safeLine } from "@/lib/emailSafety";

/** Plafond de rappels en attente par compte : bien au-delà d'un usage réel
 * (un rappel par rendez-vous à venir), mais borne l'envoi d'emails qu'un
 * seul compte peut déclencher. */
const MAX_PENDING_PER_USER = 300;

const schema = z.object({
  sendAt: z.string().datetime(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

/**
 * Crée un rappel email programmé pour un rendez-vous d'agenda (l'agenda
 * lui-même reste local-first sur mobile, cf. agenda/store.tsx — ceci ne
 * stocke que le strict nécessaire pour pouvoir envoyer l'email plus tard,
 * cf. /api/cron/email-reminders). Réservé aux comptes Premium (abonnés/en
 * essai) — les rappels automatiques ne font pas partie du palier gratuit,
 * cf. rls.sql rider_is_active_or_trialing pour l'équivalent côté RLS.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
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

  const pending = await db.emailReminder.count({ where: { userId, sentAt: null } });
  if (pending >= MAX_PENDING_PER_USER) {
    return NextResponse.json({ error: "Trop de rappels programmés." }, { status: 429 });
  }

  // Contenu saisi par l'utilisateur, envoyé depuis notre domaine : liens
  // neutralisés (cf. lib/emailSafety.ts).
  const reminder = await db.emailReminder.create({
    data: {
      userId,
      sendAt: new Date(parsed.data.sendAt),
      subject: safeLine(parsed.data.subject, 150),
      body: safeBlock(parsed.data.body, 1500),
    },
    select: { id: true },
  });

  return NextResponse.json({ id: reminder.id });
}
