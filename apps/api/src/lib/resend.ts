import { Resend } from "resend";

/**
 * Tant qu'aucun compte Resend n'est créé (`RESEND_API_KEY` vide), l'envoi est
 * un no-op silencieux plutôt qu'une erreur — même philosophie que
 * `TEMP_DISABLE_REVENUECAT` côté mobile : le reste du flux (création du
 * rappel, cron) doit pouvoir être testé sans dépendre du compte externe.
 */
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

/** Adresse d'expéditeur par défaut (domaine sandbox Resend, sans vérification
 * DNS) tant qu'un domaine "horsetrack" n'est pas configuré et vérifié. */
const FROM = process.env.RESEND_FROM_EMAIL || "Horsetrack <onboarding@resend.dev>";

export async function sendReminderEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY absent — email non envoyé (no-op) :", { to, subject });
    return false;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, text: body });
  if (error) {
    console.error("[resend] échec d'envoi :", error);
    return false;
  }
  return true;
}
