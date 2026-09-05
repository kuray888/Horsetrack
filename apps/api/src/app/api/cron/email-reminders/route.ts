import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { sendEmail } from "@/lib/resend";

/**
 * Déclenché toutes les 15 minutes par un workflow GitHub Actions (cf.
 * .github/workflows/email-reminders-cron.yml), pas par Vercel Cron : le
 * palier Hobby de Vercel ne permet qu'un cron quotidien, insuffisant pour des
 * rappels "1h avant" un rendez-vous. Le workflow appelle simplement cette
 * route déployée avec `Authorization: Bearer ${CRON_SECRET}`. Ne peut
 * réellement tourner qu'une fois l'API déployée — en local, cette route
 * reste appelable manuellement pour tester.
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
    // Claim atomique avant l'envoi : si cette route tourne deux fois en
    // parallèle (cron + appel manuel de test, explicitement permis cf.
    // commentaire ci-dessus), seule l'exécution qui gagne la course met
    // effectivement `sentAt` à jour — l'autre trouve `count: 0` et passe sans
    // renvoyer le même rappel une seconde fois.
    const claim = await db.emailReminder.updateMany({
      where: { id: reminder.id, sentAt: null },
      data: { sentAt: new Date() },
    });
    if (claim.count === 0) continue;

    const ok = await sendEmail(reminder.user.email, reminder.subject, reminder.body);
    if (ok) {
      sent++;
    } else {
      // Échec d'envoi : on libère le claim pour retenter au prochain passage du cron.
      await db.emailReminder.update({ where: { id: reminder.id }, data: { sentAt: null } });
    }
  }

  return NextResponse.json({ checked: due.length, sent });
}
