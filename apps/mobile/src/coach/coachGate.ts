/**
 * Ce que montre l'écran du coach (décision du 2026-11-13) : un compte gratuit
 * a 3 questions offertes en tout pour découvrir le coach sur son cheval ;
 * le serveur en tient le compte (/api/coach/status, freeQuestionsLeft). Les
 * idées de séance et le résumé du mois restent Premium. Testé dans
 * coachGate.test.ts.
 */
export type CoachGate = "premium" | "free" | "locked" | "loading" | "offline";

/** `statusFailed` : la lecture du statut a échoué (hors ligne, serveur muet) —
 * sans lui, un compte gratuit restait sur le squelette de chargement. */
export function coachGate(
  isPremium: boolean,
  status: { freeQuestionsLeft?: number | null } | null,
  statusFailed = false
): CoachGate {
  if (isPremium) return "premium";
  if (!status) return statusFailed ? "offline" : "loading";
  return (status.freeQuestionsLeft ?? 0) > 0 ? "free" : "locked";
}
