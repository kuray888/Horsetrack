import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { sendEmail } from "@/lib/resend";
import {
  PURGE_AFTER_END_MS,
  STALE_AFTER_MS,
  needsStaleAlert,
  parseContacts,
  publicBaseUrl,
  shouldAutoEnd,
  staleEmail,
} from "@/lib/rideSafety";

/**
 * Surveillance des balades suivies, toutes les 15 minutes (même workflow
 * GitHub Actions que les rappels email, cf. .github/workflows/email-reminders-cron.yml) :
 * - prévient les proches d'un téléphone muet depuis 15 min ;
 * - clôt une balade oubliée depuis 12 h ;
 * - purge les balades terminées depuis 7 jours.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const open = await db.rideShare.findMany({
    where: { status: { in: ["ACTIVE", "ALERT"] } },
    take: 500,
  });

  let ended = 0;
  let warned = 0;
  for (const share of open) {
    if (shouldAutoEnd(share, now)) {
      await db.rideShare.update({ where: { id: share.id }, data: { status: "ENDED", endedAt: now } });
      ended++;
      continue;
    }
    if (!needsStaleAlert(share, now)) continue;
    // Claim atomique, comme les rappels email : un passage en double
    // n'envoie pas deux fois la même alerte.
    const claim = await db.rideShare.updateMany({
      where: { id: share.id, staleAlertSentAt: share.staleAlertSentAt },
      data: { staleAlertSentAt: now },
    });
    if (claim.count === 0) continue;
    const email = staleEmail({
      riderName: share.riderName,
      horseName: share.horseName,
      viewUrl: `${publicBaseUrl(req.url)}/suivi/${share.id}`,
      lat: share.lastLat,
      lng: share.lastLng,
      lastAt: share.lastPointAt ?? share.startedAt,
    });
    await Promise.all(
      parseContacts(share.contacts).map((c) => sendEmail(c.email, email.subject, email.body).catch(() => false))
    );
    warned++;
  }

  const purged = await db.rideShare.deleteMany({
    where: { status: "ENDED", endedAt: { lt: new Date(now.getTime() - PURGE_AFTER_END_MS) } },
  });

  return NextResponse.json({ checked: open.length, warned, ended, purged: purged.count, staleAfterMin: STALE_AFTER_MS / 60_000 });
}
