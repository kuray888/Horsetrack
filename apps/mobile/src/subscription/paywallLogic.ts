/**
 * Logique pure du paywall (textes contextuels, calculs de prix et de dates
 * d'essai) — séparée de PaywallView/revenuecat.ts pour rester testable avec
 * vitest sans runtime natif, comme ./logic.ts.
 */
import type { BillingPeriod } from "./logic";

/** D'où le paywall a été ouvert — pilote le titre, l'ordre des bénéfices et
 * la propriété `placement` des événements analytics. */
export type PaywallPlacement =
  | "onboarding"
  | "horses"
  | "reminders"
  | "vault"
  | "sharing"
  | "competitions"
  | "budget"
  | "journal_photo"
  | "profile"
  | "trial_ending";

export const PAYWALL_PLACEMENTS: readonly PaywallPlacement[] = [
  "onboarding",
  "horses",
  "reminders",
  "vault",
  "sharing",
  "competitions",
  "budget",
  "journal_photo",
  "profile",
  "trial_ending",
];

export function parsePlacement(value: unknown): PaywallPlacement {
  return typeof value === "string" && (PAYWALL_PLACEMENTS as readonly string[]).includes(value)
    ? (value as PaywallPlacement)
    : "profile";
}

export type BenefitId = "horses" | "reminders" | "vault" | "sharing" | "competitions" | "budget";

export const BENEFITS: Record<BenefitId, { icon: string; text: string }> = {
  horses: { icon: "horse-variant", text: "Tous tes chevaux, sans limite" },
  reminders: { icon: "bell-ring-outline", text: "Un rappel avant chaque soin : véto, maréchal, vaccins, dentiste" },
  vault: { icon: "folder-lock-outline", text: "Tous tes papiers rangés : ordonnances, factures, carnet de santé" },
  sharing: { icon: "account-multiple-outline", text: "Partage avec ta demi-pension, ton coach ou ton groom" },
  competitions: { icon: "trophy-outline", text: "Concours détaillés, épreuve par épreuve" },
  budget: { icon: "cash-multiple", text: "Budget complet : payé, à régler, répartition" },
};

const DEFAULT_BENEFIT_ORDER: BenefitId[] = ["horses", "reminders", "vault", "sharing", "competitions", "budget"];

/** Bénéfice à remonter en tête selon le contexte d'ouverture. */
const LEAD_BENEFIT: Partial<Record<PaywallPlacement, BenefitId>> = {
  horses: "horses",
  reminders: "reminders",
  vault: "vault",
  sharing: "sharing",
  competitions: "competitions",
  budget: "budget",
  journal_photo: "vault",
};

/** Bénéfices affichés, celui du contexte en premier. `count` limite la liste
 * visible (le reste figure dans le comparatif repliable). */
export function orderedBenefits(placement: PaywallPlacement, count = 4): BenefitId[] {
  const lead = LEAD_BENEFIT[placement];
  const order = lead ? [lead, ...DEFAULT_BENEFIT_ORDER.filter((b) => b !== lead)] : DEFAULT_BENEFIT_ORDER;
  return order.slice(0, count);
}

export type PaywallCopy = { icon: string; title: string; subtitle: string };

/** Titre + sous-titre selon le contexte. `horseNames` : chevaux possédés
 * connus à ce stade (brouillon d'onboarding, ou cheval concerné dans l'app). */
export function paywallCopy(placement: PaywallPlacement, horseNames: string[] = []): PaywallCopy {
  const names = horseNames.map((n) => n.trim()).filter(Boolean);
  const first = names[0] ?? "ton cheval";
  switch (placement) {
    case "onboarding":
      if (names.length >= 2) {
        return {
          icon: "horse-variant",
          title: `Garde ${joinNames(names)} dans ton écurie.`,
          subtitle: "La version gratuite suit 1 cheval. Premium les suit tous, sans limite.",
        };
      }
      return {
        icon: "bell-ring-outline",
        title: `Ne rate plus aucun soin de ${first}.`,
        subtitle:
          "Vaccins, maréchal, véto : HorseTrack te prévient à temps et garde tous ses papiers au même endroit.",
      };
    case "horses":
      return {
        icon: "horse-variant",
        title: "Toute ton écurie, au même endroit.",
        subtitle: "Ajoute autant de chevaux que tu veux, chacun avec son planning, sa santé et son budget.",
      };
    case "reminders":
      return {
        icon: "bell-ring-outline",
        title: "Laisse HorseTrack se souvenir du prochain rendez-vous.",
        subtitle: "Une notification avant chaque véto, maréchal, vaccin ou dentiste.",
      };
    case "vault":
      return {
        icon: "folder-lock-outline",
        title: "Ordonnances, factures, carnet : tout est rangé.",
        subtitle: "Retrouve n'importe quel papier en deux secondes, même à l'écurie.",
      };
    case "sharing":
      return {
        icon: "account-multiple-outline",
        title: `Partage ${names.length ? first : "ton cheval"} avec ta demi-pension.`,
        subtitle: "Ta DP, ton coach ou ton groom retrouvent son planning, ses soins et ses rendez-vous.",
      };
    case "competitions":
      return {
        icon: "trophy-outline",
        title: "Prépare chaque épreuve de tes concours.",
        subtitle: "Horaires, épreuves et résultats, épreuve par épreuve.",
      };
    case "budget":
      return {
        icon: "cash-multiple",
        title: `Sache exactement ce que ${first} te coûte.`,
        subtitle: "Ce qui est payé, ce qui reste à régler, et où part ton budget.",
      };
    case "journal_photo":
      return {
        icon: "camera-outline",
        title: "Garde la photo de chaque séance.",
        subtitle: "Revois ses progrès mois après mois.",
      };
    case "trial_ending":
      return {
        icon: "star-outline",
        title: "Garde Premium après ton essai.",
        subtitle: "Tes chevaux, rappels et documents restent exactement comme tu les as laissés.",
      };
    case "profile":
    default:
      return {
        icon: "star-outline",
        title: "Tout HorseTrack, pour toute ton écurie.",
        subtitle: "Rappels, documents, partage et chevaux illimités.",
      };
  }
}

/** « A », « A et B », « A, B et C » ; au-delà de 3 : « A, B et 2 autres ». */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} et ${names[2]}`;
  return `${names[0]}, ${names[1]} et ${names.length - 2} autres`;
}

// --- Prix -------------------------------------------------------------------

/** Repli si le store ne répond pas (dev sans RevenueCat, réseau) — les
 * montants réels viennent toujours de `priceString` quand il est disponible. */
export const FALLBACK_PRICE: Record<BillingPeriod, { price: number; priceString: string }> = {
  MONTHLY: { price: 3.99, priceString: "3,99 €" },
  ANNUAL: { price: 39.99, priceString: "39,99 €" },
};

export const PERIOD_SUFFIX: Record<BillingPeriod, string> = { MONTHLY: "/mois", ANNUAL: "/an" };

/** Économie de l'annuel par rapport à 12 mensualités, arrondie à l'entier
 * INFÉRIEUR (jamais surestimée). null si non calculable ou nulle. */
export function annualSavingsPercent(monthlyPrice: number, annualPrice: number): number | null {
  if (!(monthlyPrice > 0) || !(annualPrice > 0)) return null;
  const pct = Math.floor((1 - annualPrice / (monthlyPrice * 12)) * 100);
  return pct > 0 ? pct : null;
}

// --- Essai ------------------------------------------------------------------

export type TrialPeriod = { unit: "DAY" | "WEEK" | "MONTH" | "YEAR"; count: number };

export const DEFAULT_TRIAL: TrialPeriod = { unit: "MONTH", count: 1 };

export function parseTrialPeriod(unit: string | null | undefined, count: number | null | undefined): TrialPeriod | null {
  if (!unit || !count || count <= 0) return null;
  const u = unit.toUpperCase();
  if (u !== "DAY" && u !== "WEEK" && u !== "MONTH" && u !== "YEAR") return null;
  return { unit: u, count };
}

/** « 1 mois », « 7 jours », « 2 semaines », « 1 an ». */
export function trialDurationLabel(t: TrialPeriod): string {
  const plural = t.count > 1;
  switch (t.unit) {
    case "DAY":
      return `${t.count} jour${plural ? "s" : ""}`;
    case "WEEK":
      return `${t.count} semaine${plural ? "s" : ""}`;
    case "MONTH":
      return `${t.count} mois`;
    case "YEAR":
      return `${t.count} an${plural ? "s" : ""}`;
  }
}

/** Date de fin d'un essai démarré à `start` — même arithmétique calendaire que
 * les stores (un mois = même jour du mois suivant). */
export function trialEndDate(start: Date, t: TrialPeriod): Date {
  const end = new Date(start);
  switch (t.unit) {
    case "DAY":
      end.setDate(end.getDate() + t.count);
      break;
    case "WEEK":
      end.setDate(end.getDate() + 7 * t.count);
      break;
    case "MONTH":
      end.setMonth(end.getMonth() + t.count);
      break;
    case "YEAR":
      end.setFullYear(end.getFullYear() + t.count);
      break;
  }
  return end;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quand prévenir avant la fin d'un essai : 3 jours avant, sinon la veille
 * pour un essai déjà presque fini, sinon jamais (null). Jamais dans le passé. */
export function trialReminderDate(end: Date, now: Date = new Date()): Date | null {
  for (const daysBefore of [3, 1]) {
    const at = new Date(end.getTime() - daysBefore * DAY_MS);
    if (at.getTime() > now.getTime() + 60 * 1000) return at;
  }
  return null;
}

// Noms de mois écrits en dur plutôt que toLocaleDateString, comme
// lib/dateFormat.ts : rendu identique quel que soit le support Intl du moteur JS.
const MONTHS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 25 octobre » (ou « 25 octobre 2027 » si ce n'est pas l'année en cours). */
export function formatDayMonth(d: Date, now: Date = new Date()): string {
  const base = `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** « 25 octobre 2026 ». */
export function formatFullDate(d: Date): string {
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

// --- Relance douce (carte Accueil) -----------------------------------------

export const UPSELL_MIN_HEALTH_APPOINTMENTS = 3;
export const UPSELL_SNOOZE_DAYS = 14;

/** Carte « veux-tu qu'on te prévienne ? » de l'Accueil : seulement pour un
 * compte gratuit qui a déjà noté plusieurs rendez-vous santé (le besoin de
 * rappels est réel), et jamais dans les 14 jours qui suivent une fermeture. */
export function shouldShowRemindersUpsell(input: {
  premium: boolean;
  healthAppointments: number;
  dismissedAt: Date | null;
  now?: Date;
}): boolean {
  if (input.premium || input.healthAppointments < UPSELL_MIN_HEALTH_APPOINTMENTS) return false;
  if (!input.dismissedAt) return true;
  const now = input.now ?? new Date();
  return now.getTime() - input.dismissedAt.getTime() >= UPSELL_SNOOZE_DAYS * DAY_MS;
}
