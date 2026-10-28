/**
 * Règles des codes promo — logique pure (aucun accès base), pour rester
 * testable sans Prisma et partagée par /api/promo/redeem et l'admin.
 *
 * Deux sortes de codes (cf. schema.prisma PromoKind) :
 * - PREMIUM_DAYS : N jours de Premium appliqués par notre serveur.
 * - STORE_OFFER : remise sur l'abonnement, appliquée exclusivement par
 *   Apple/Google (code d'offre store). Le serveur vérifie les conditions puis
 *   renvoie l'adresse de rédemption du store ; il ne calcule ni n'applique
 *   jamais de prix — la feuille du store affiche et facture le vrai montant.
 */

export type PromoKindValue = "PREMIUM_DAYS" | "STORE_OFFER";
export type PromoEligibilityValue = "ANYONE" | "NEVER_SUBSCRIBED" | "LAPSED_SUBSCRIBERS";
export type PromoDiscountTypeValue = "PERCENT" | "AMOUNT" | "FREE_PERIOD";

export type PromoForRules = {
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  eligibility: PromoEligibilityValue;
  maxAccountAgeDays: number | null;
};

export type RiderForRules = {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  /** Posé par le webhook RevenueCat au premier octroi store : signe qu'un
   * abonnement (ou essai) store a existé pour ce compte. */
  revenuecatId: string | null;
  createdAt: Date;
};

export type PromoRefusal = { ok: false; status: number; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Compte Premium à l'instant `now` (abonné, ou essai pas encore terminé). */
export function isPremiumNow(rider: Pick<RiderForRules, "subscriptionStatus" | "trialEndsAt">, now: Date): boolean {
  if (rider.subscriptionStatus === "ACTIVE") return true;
  return rider.subscriptionStatus === "TRIALING" && !!rider.trialEndsAt && rider.trialEndsAt > now;
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function frenchDate(d: Date): string {
  return `${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Le code peut-il être utilisé par ce compte maintenant ? Ne regarde ni le
 * plafond d'utilisations ni les rédemptions passées (vérifiés en transaction
 * verrouillée par la route). Messages au tutoiement, comme l'app. */
export function checkPromoAvailability(
  promo: PromoForRules,
  rider: RiderForRules,
  now: Date = new Date()
): { ok: true } | PromoRefusal {
  if (!promo.active) {
    return { ok: false, status: 404, error: "Ce code promo n'existe pas ou n'est plus valide." };
  }
  if (promo.startsAt && promo.startsAt > now) {
    return { ok: false, status: 403, error: `Ce code promo sera valable à partir du ${frenchDate(promo.startsAt)}.` };
  }
  if (promo.expiresAt && promo.expiresAt < now) {
    return { ok: false, status: 410, error: "Ce code promo a expiré." };
  }
  if (promo.maxAccountAgeDays !== null && now.getTime() - rider.createdAt.getTime() > promo.maxAccountAgeDays * DAY_MS) {
    return { ok: false, status: 403, error: "Ce code promo est réservé aux comptes créés récemment." };
  }
  if (promo.eligibility === "NEVER_SUBSCRIBED" && rider.revenuecatId) {
    return { ok: false, status: 403, error: "Ce code promo est réservé aux personnes qui n'ont jamais été abonnées." };
  }
  if (promo.eligibility === "LAPSED_SUBSCRIBERS" && (!rider.revenuecatId || isPremiumNow(rider, now))) {
    return { ok: false, status: 403, error: "Ce code promo est réservé aux anciens abonnés." };
  }
  return { ok: true };
}

/** Normalise un code saisi : espaces retirés, majuscules. */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Codes acceptés à la création (admin) : lettres, chiffres, tiret, 3 à 32. */
export const PROMO_CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;

/** Adresse officielle de rédemption d'un code d'offre, code prérempli. Apple :
 * https://developer.apple.com/documentation/storekit/supporting-offer-codes-in-your-app */
export function storeRedeemUrl(platform: "ios" | "android", code: string, appStoreId: string): string {
  const c = encodeURIComponent(code);
  return platform === "android"
    ? `https://play.google.com/redeem?code=${c}`
    : `https://apps.apple.com/redeem?ctx=offercodes&id=${encodeURIComponent(appStoreId)}&code=${c}`;
}

/** « −30 % », « −10,00 € », « 3 mois offerts » — pour l'admin. */
export function describeDiscount(type: PromoDiscountTypeValue | null, value: number | null): string | null {
  if (!type || value === null) return null;
  switch (type) {
    case "PERCENT":
      return `−${value} %`;
    case "AMOUNT":
      return `−${(value / 100).toFixed(2).replace(".", ",")} €`;
    case "FREE_PERIOD":
      return `${value} mois offert${value > 1 ? "s" : ""}`;
  }
}

/** « 2026-11-01 » saisi dans l'admin → instant correspondant à minuit (ou
 * 23:59:59 avec `endOfDay`) heure de Paris, heure d'été comprise. null si la
 * saisie est vide ou invalide. */
export function parisDayBoundary(day: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const wall = Date.UTC(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  if (new Date(wall).getUTCDate() !== d) return null;
  // Décalage de Paris à cet instant (1 h ou 2 h) : on lit l'heure murale de
  // Paris pour l'instant UTC `wall`, l'écart donne le décalage.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(wall))
      .map((p) => [p.type, p.value])
  );
  const parisWall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(wall - (parisWall - wall));
}

/** Campagne qui désigne une offre de retour (saisie dans /admin). */
export const WINBACK_CAMPAIGNS = new Set(["retour", "winback"]);

export type WinbackCandidate = PromoForRules & {
  id: string;
  code: string;
  kind: PromoKindValue;
  campaign: string | null;
  maxRedemptions: number | null;
  /** Rédemptions déjà enregistrées, tous comptes confondus. */
  redemptionCount: number;
  /** Statut de la rédemption de CE compte, s'il y en a une. */
  ownRedemptionStatus: string | null;
};

/**
 * Offre de retour à proposer à ce compte, ou null.
 *
 * Seulement une remise store (jamais des jours Premium, cf. règle App Store
 * 3.1.1), d'une campagne « retour », disponible pour ce compte (dates,
 * éligibilité — « anciens abonnés » en pratique), pas épuisée, et pas déjà
 * utilisée par lui. Une offre ouverte puis abandonnée sur la feuille Apple
 * reste proposée : elle peut être rouverte sans consommer de place. Entre
 * plusieurs offres, celle qui expire le plus tôt.
 */
export function pickWinbackOffer(
  candidates: WinbackCandidate[],
  rider: RiderForRules,
  now: Date = new Date()
): WinbackCandidate | null {
  if (isPremiumNow(rider, now)) return null;
  const eligible = candidates.filter((c) => {
    if (c.kind !== "STORE_OFFER") return false;
    if (!c.campaign || !WINBACK_CAMPAIGNS.has(c.campaign.trim().toLowerCase())) return false;
    if (!checkPromoAvailability(c, rider, now).ok) return false;
    if (c.ownRedemptionStatus && c.ownRedemptionStatus !== "STORE_REDIRECTED") return false;
    if (!c.ownRedemptionStatus && c.maxRedemptions !== null && c.redemptionCount >= c.maxRedemptions) return false;
    return true;
  });
  eligible.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
  return eligible[0] ?? null;
}
