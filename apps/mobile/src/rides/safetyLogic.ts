/**
 * Décisions de la sécurité en balade, sans effet de bord (testées,
 * safetyLogic.test.ts) — rides/safety.ts exécute les actions.
 *
 * Déroulé :
 * 1. le cavalier ne bouge plus depuis 5 min (rideMath.isImmobile) → une
 *    notification « Tout va bien ? » ;
 * 2. sans réponse au bout de 2 min → alerte aux proches (une seule) ;
 * 3. « Je vais bien », ou le cavalier repart → tout s'annule, et les
 *    vérifications se taisent 10 min (une pause pique-nique n'en déclenche
 *    pas une toutes les 5 min).
 * Une séance en pause ne déclenche rien : le cavalier l'a voulue.
 */

export const CHECK_TIMEOUT_MS = 2 * 60_000;
export const SNOOZE_MS = 10 * 60_000;
export const POSITION_EVERY_MS = 60_000;

export type SafetyState = {
  /** Début de la vérification en cours (« Tout va bien ? » envoyé), sinon null. */
  checkStartedAt: number | null;
  snoozeUntil: number;
  alertSent: boolean;
};

export const INITIAL_SAFETY_STATE: SafetyState = { checkStartedAt: null, snoozeUntil: 0, alertSent: false };

export type SafetyAction = "notify_check" | "cancel_check" | "send_alert";

export function evaluateSafety(
  state: SafetyState,
  input: { now: number; immobile: boolean; paused: boolean }
): { state: SafetyState; actions: SafetyAction[] } {
  if (input.paused || !input.immobile) {
    // Repartir (ou mettre en pause) rassure : la vérification s'annule, et une
    // prochaine immobilité pourra de nouveau alerter.
    const actions: SafetyAction[] = state.checkStartedAt !== null ? ["cancel_check"] : [];
    if (state.checkStartedAt === null && !state.alertSent) return { state, actions };
    return { state: { ...state, checkStartedAt: null, alertSent: false }, actions };
  }
  if (state.alertSent || input.now < state.snoozeUntil) return { state, actions: [] };
  if (state.checkStartedAt === null) {
    return { state: { ...state, checkStartedAt: input.now }, actions: ["notify_check"] };
  }
  if (input.now - state.checkStartedAt >= CHECK_TIMEOUT_MS) {
    return { state: { ...state, checkStartedAt: null, alertSent: true }, actions: ["cancel_check", "send_alert"] };
  }
  return { state, actions: [] };
}

/** « Je vais bien » : vérification close, silence pendant 10 min. */
export function acknowledgeSafety(state: SafetyState, now: number): { state: SafetyState; actions: SafetyAction[] } {
  return {
    state: { checkStartedAt: null, snoozeUntil: now + SNOOZE_MS, alertSent: false },
    actions: state.checkStartedAt !== null ? ["cancel_check"] : [],
  };
}

export function shouldSendPosition(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= POSITION_EVERY_MS;
}

export type SafetyContact = { name: string; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Proches valides (nom et email), sans doublon d'email, 3 au plus. */
export function cleanContacts(contacts: SafetyContact[]): SafetyContact[] {
  const seen = new Set<string>();
  const out: SafetyContact[] = [];
  for (const c of contacts) {
    const name = c.name.trim();
    const email = c.email.trim().toLowerCase();
    if (!name || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: name.slice(0, 60), email });
    if (out.length === 3) break;
  }
  return out;
}
