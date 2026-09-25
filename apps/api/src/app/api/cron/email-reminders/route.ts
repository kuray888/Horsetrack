import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { sendEmail } from "@/lib/resend";
import { getAuthEmail } from "@/lib/supabaseAdmin";

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

  // Par lots : un passage toutes les 15 min absorbe largement le flux normal,
  // et une file anormalement longue ne fait pas dépasser le temps d'exécution
  // de la fonction (le reste part au passage suivant).
  const due = await db.emailReminder.findMany({
    where: { sendAt: { lte: new Date() }, sentAt: null },
    orderBy: { sendAt: "asc" },
    take: 200,
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

    // Destinataire = email de connexion (Supabase Auth), jamais
    // public.users.email : cette copie n'est pas tenue à jour et a longtemps
    // été modifiable par l'utilisateur (relais d'emails vers un tiers, cf.
    // rls.sql protect_user_email).
    const to = await getAuthEmail(reminder.userId);
    // Compte introuvable côté Auth : rien à envoyer, et le retenter à chaque
    // passage finirait par occuper tout le lot (cf. `take` ci-dessus). Le
    // claim reste posé, le rappel est abandonné.
    if (!to) continue;
    const ok = await sendEmail(to, reminder.subject, reminder.body);
    if (ok) {
      sent++;
    } else {
      // Échec d'envoi : on libère le claim pour retenter au prochain passage du cron.
      await db.emailReminder.update({ where: { id: reminder.id }, data: { sentAt: null } });
    }
  }

  return NextResponse.json({ checked: due.length, sent });
}
