/**
 * Ce que montre l'écran du coach (décision du 2026-11-13) : un compte gratuit
 * a 3 questions offertes en tout pour découvrir le coach sur son cheval ;
 * le serveur en tient le compte (/api/coach/status, freeQuestionsLeft). Les
 * idées de séance et le résumé du mois restent Premium. Testé dans
 * coachGate.test.ts.
 */
export type CoachGate = "premium" | "free" | "locked" | "loading";

export function coachGate(isPremium: boolean, status: { freeQuestionsLeft?: number | null } | null): CoachGate {
  if (isPremium) return "premium";
  if (!status) return "loading";
  return (status.freeQuestionsLeft ?? 0) > 0 ? "free" : "locked";
}
