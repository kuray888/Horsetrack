import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";
import {
  alertEmail,
  allClearEmail,
  canSendAlert,
  isShareToken,
  parseContacts,
  publicBaseUrl,
  updateSchema,
} from "@/lib/rideSafety";

/**
 * Suite d'une balade suivie : position (toutes les minutes), alerte (cavalier
 * immobile ou appel à l'aide), fin. Seul le cavalier qui a créé le partage
 * peut l'écrire : `userId` est vérifié à chaque appel.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { token } = await params;
  if (!isShareToken(token)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const share = await db.rideShare.findUnique({ where: { id: token } });
  if (!share || share.userId !== userId) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const now = new Date();
  const input = parsed.data;

  if (input.action === "position") {
    if (share.status === "ENDED") return NextResponse.json({ error: "Balade terminée" }, { status: 409 });
    await db.rideShare.update({
      where: { id: token },
      data: { lastLat: input.lat, lastLng: input.lng, lastAccuracy: input.accuracy ?? null, lastPointAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  const ctx = { riderName: share.riderName, horseName: share.horseName, viewUrl: `${publicBaseUrl(req.url)}/suivi/${token}` };
  const contacts = parseContacts(share.contacts);

  if (input.action === "alert") {
    if (!canSendAlert(share, now)) return NextResponse.json({ sent: false });
    const lat = input.lat ?? share.lastLat;
    const lng = input.lng ?? share.lastLng;
    // Claim avant l'envoi : deux appels simultanés n'envoient qu'une alerte.
    const claim = await db.rideShare.updateMany({
      where: { id: token, alertSentAt: share.alertSentAt },
      data: {
        status: "ALERT",
        alertSentAt: now,
        ...(input.lat != null && input.lng != null ? { lastLat: input.lat, lastLng: input.lng, lastPointAt: now } : {}),
      },
    });
    if (claim.count === 0) return NextResponse.json({ sent: false });
    const email = alertEmail({
      ...ctx,
      reason: input.reason,
      lat: lat ?? null,
      lng: lng ?? null,
      at: input.lat != null ? now : share.lastPointAt,
    });
    const results = await Promise.all(contacts.map((c) => sendEmail(c.email, email.subject, email.body).catch(() => false)));
    return NextResponse.json({ sent: true, emailsSent: results.filter(Boolean).length });
  }

  // Fin de balade. Si les proches ont été inquiétés, ils sont rassurés.
  if (share.status !== "ENDED") {
    await db.rideShare.update({ where: { id: token }, data: { status: "ENDED", endedAt: now } });
    if (share.alertSentAt || share.staleAlertSentAt) {
      const email = allClearEmail(ctx);
      await Promise.all(contacts.map((c) => sendEmail(c.email, email.subject, email.body).catch(() => false)));
    }
  }
  return NextResponse.json({ ok: true });
}
