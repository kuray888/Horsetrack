import type { CoachQuotas } from "./config";

/** Questions offertes à un compte gratuit, une fois pour toutes (décision du
 * 2026-11-13) : il découvre le coach sur son propre cheval avant le paywall.
 * Les idées de séance et le résumé du mois restent Premium. */
export const FREE_QUESTIONS = 3;

/** Peut-il poser une question maintenant, et combien lui en reste-t-il ?
 * `quotas` : null sans Premium. Logique pure, testée dans allowance.test.ts. */
export function questionAllowance(input: {
  quotas: CoachQuotas | null;
  usedThisMonth: number;
  usedEver: number;
}): { allowed: boolean; left: number; free: boolean } {
  if (input.quotas) {
    const left = Math.max(0, input.quotas.questionsPerMonth - input.usedThisMonth);
    return { allowed: left > 0, left, free: false };
  }
  const left = Math.max(0, FREE_QUESTIONS - input.usedEver);
  return { allowed: left > 0, left, free: true };
}
