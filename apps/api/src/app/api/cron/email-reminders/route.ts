import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { sendReminderEmail } from "@/lib/resend";

/**
 * Déclenché par Vercel Cron (cf. vercel.json) toutes les 15 minutes — Vercel
 * injecte automatiquement `Authorization: Bearer ${CRON_SECRET}` sur les
 * invocations qu'il déclenche lui-même tant que `CRON_SECRET` est défini en
 * variable d'env, donc pas de configuration manuelle supplémentaire côté
 * Vercel au-delà de la définir. Ne peut réellement tourner qu'une fois l'API
 * déployée — en local, cette route reste appelable manuellement pour tester.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await db.emailReminder.findMany({
    where: { sendAt: { lte: new Date() }, sentAt: null },
    include: { user: { select: { email: true } } },
  });

  let sent = 0;
  for (const reminder of due) {
    const ok = await sendReminderEmail(reminder.user.email, reminder.subject, reminder.body);
    if (ok) {
      await db.emailReminder.update({ where: { id: reminder.id }, data: { sentAt: new Date() } });
      sent++;
    }
  }

  return NextResponse.json({ checked: due.length, sent });
}
