/**
 * Contexte promo de la session, joint aux événements du paywall et de l'achat
 * (paywall_viewed, purchase_started, purchase_completed) pour mesurer l'effet
 * des campagnes dans PostHog : un paywall vu après un code valide convertit-il
 * mieux ? l'offre de retour amène-t-elle à l'achat ?
 *
 * En mémoire seulement, remis à zéro au lancement : c'est le parcours en
 * cours qu'on mesure. Rien n'est envoyé au serveur Horsetrack.
 */

export type PromoContext = {
  /** Dernier code saisi : refusé, accepté (jours offerts), ou offre store. */
  lastCode: { code: string; result: "invalid" | "applied" | "store_offer" | "accepted" } | null;
  /** Code de l'offre de retour affichée sur l'Accueil, s'il y en a une. */
  winbackCode: string | null;
};

let context: PromoContext = { lastCode: null, winbackCode: null };

export function notePromoCodeResult(code: string, result: NonNullable<PromoContext["lastCode"]>["result"]): void {
  context = { ...context, lastCode: { code: code.trim().toUpperCase(), result } };
}

export function noteWinbackOfferShown(code: string): void {
  context = { ...context, winbackCode: code };
}

export function getPromoContext(): PromoContext {
  return context;
}

/** Propriétés d'événement. Le code n'est joint que s'il a été accepté : un
 * code refusé peut être une faute de frappe ou un texte quelconque. */
export function promoAnalyticsProps(ctx: PromoContext): Record<string, string | boolean | null> {
  const valid = ctx.lastCode && ctx.lastCode.result !== "invalid" ? ctx.lastCode : null;
  return {
    promo_code_state: ctx.lastCode ? (valid ? "valid" : "invalid") : "none",
    promo_code: valid?.code ?? null,
    promo_code_kind: valid?.result ?? null,
    winback_offer: ctx.winbackCode !== null,
  };
}

/** Tests uniquement. */
export function resetPromoContextForTests(): void {
  context = { lastCode: null, winbackCode: null };
}
