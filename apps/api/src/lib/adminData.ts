import { db, BillingPeriod, SubscriptionStatus } from "@cheval/db";

/**
 * Lectures de la console d'administration (/admin). Exclusivement en
 * lecture : l'état d'abonnement reste piloté par RevenueCat (webhook), jamais
 * modifié à la main d'ici.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminStats = {
  accounts: number;
  onboarded: number;
  newLast7: number;
  newLast30: number;
  paidMonthly: number;
  paidAnnual: number;
  paidOther: number;
  trialsRunning: number;
  horses: number;
};

export async function loadAdminStats(now: Date = new Date()): Promise<AdminStats> {
  const [accounts, onboarded, newLast7, newLast30, paid, trialsRunning, horses] = await Promise.all([
    db.riderProfile.count(),
    db.riderProfile.count({ where: { onboardingCompletedAt: { not: null } } }),
    db.riderProfile.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
    db.riderProfile.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    db.riderProfile.groupBy({
      by: ["billingPeriod"],
      where: { subscriptionStatus: SubscriptionStatus.ACTIVE },
      _count: { _all: true },
    }),
    db.riderProfile.count({ where: { subscriptionStatus: SubscriptionStatus.TRIALING, trialEndsAt: { gt: now } } }),
    db.horse.count(),
  ]);
  const paidBy = (p: BillingPeriod | null) => paid.find((g) => g.billingPeriod === p)?._count._all ?? 0;
  return {
    accounts,
    onboarded,
    newLast7,
    newLast30,
    paidMonthly: paidBy(BillingPeriod.MONTHLY),
    paidAnnual: paidBy(BillingPeriod.ANNUAL),
    paidOther: paidBy(null),
    trialsRunning,
    horses,
  };
}

export async function loadPromoCodes() {
  const [codes, byStatus] = await Promise.all([
    db.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    db.promoCodeRedemption.groupBy({ by: ["promoCodeId", "status"], _count: { _all: true } }),
  ]);
  return codes.map((c) => {
    const rows = byStatus.filter((r) => r.promoCodeId === c.id);
    const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
    return {
      ...c,
      uses: rows.reduce((n, r) => n + r._count._all, 0),
      applied: count("APPLIED"),
      alreadyPremium: count("ALREADY_PREMIUM"),
      redirected: count("STORE_REDIRECTED"),
      converted: count("CONVERTED"),
    };
  });
}

export type AdminPromoCode = Awaited<ReturnType<typeof loadPromoCodes>>[number];

export async function loadRecentRedemptions(limit = 15) {
  return db.promoCodeRedemption.findMany({
    orderBy: { redeemedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      redeemedAt: true,
      convertedAt: true,
      promoCode: { select: { code: true } },
      rider: { select: { user: { select: { email: true } } } },
    },
  });
}

/** Fiche d'un compte, par email exact (insensible à la casse). */
export async function findAccountByEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return null;
  return db.user.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      createdAt: true,
      riderProfile: {
        select: {
          subscriptionStatus: true,
          subscriptionTier: true,
          billingPeriod: true,
          trialEndsAt: true,
          revenuecatId: true,
          onboardingCompletedAt: true,
          lastWebhookEventAt: true,
          _count: { select: { horses: true } },
          promoRedemptions: {
            orderBy: { redeemedAt: "desc" },
            select: { status: true, redeemedAt: true, promoCode: { select: { code: true } } },
          },
        },
      },
    },
  });
}

export type FunnelStep = { label: string; count: number };

/**
 * Tunnel d'activation des comptes créés sur les `days` derniers jours, lu
 * dans la base (chevaux, séances et abonnements y sont tous synchronisés) :
 * où perd-on les nouveaux cavaliers ? Chaque étape compte les comptes de la
 * même cohorte qui l'ont atteinte, quel que soit l'ordre.
 *
 * Les séances comptées sont celles des chevaux POSSÉDÉS par le compte : un
 * cavalier en demi-pension sans cheval à lui s'arrête donc à l'étape cheval,
 * ce qui reste le bon signal pour l'activation.
 */
export async function loadActivationFunnel(days = 30, now: Date = new Date()): Promise<FunnelStep[]> {
  const cohort = { createdAt: { gte: new Date(now.getTime() - days * DAY_MS) } };
  const [created, onboarded, withHorse, withSession, withDoneSession, startedTrial, paying] = await Promise.all([
    db.riderProfile.count({ where: cohort }),
    db.riderProfile.count({ where: { ...cohort, onboardingCompletedAt: { not: null } } }),
    db.riderProfile.count({ where: { ...cohort, horses: { some: {} } } }),
    db.riderProfile.count({ where: { ...cohort, horses: { some: { trainingSessions: { some: {} } } } } }),
    db.riderProfile.count({
      where: { ...cohort, horses: { some: { trainingSessions: { some: { completed: true } } } } },
    }),
    // Un essai store laisse revenuecatId (posé par le webhook), un essai par
    // code promo laisse trialEndsAt.
    db.riderProfile.count({ where: { ...cohort, OR: [{ revenuecatId: { not: null } }, { trialEndsAt: { not: null } }] } }),
    db.riderProfile.count({
      where: { ...cohort, subscriptionStatus: SubscriptionStatus.ACTIVE, billingPeriod: { not: null } },
    }),
  ]);
  return [
    { label: "Comptes créés", count: created },
    { label: "Onboarding terminé", count: onboarded },
    { label: "Au moins un cheval", count: withHorse },
    { label: "Au moins une séance", count: withSession },
    { label: "Une séance cochée faite", count: withDoneSession },
    { label: "Essai démarré", count: startedTrial },
    { label: "Abonné payant", count: paying },
  ];
}

/** Comptes ayant enregistré ou coché une séance sur les 7 derniers jours :
 * l'indicateur d'usage réel (ouvrir l'app ne suffit pas). */
export async function loadWeeklyActiveRiders(now: Date = new Date()): Promise<number> {
  return db.riderProfile.count({
    where: { horses: { some: { trainingSessions: { some: { updatedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } } } } },
  });
}

/** Dates de création des comptes des `weeks` dernières semaines (graphique
 * des inscriptions, cf. lib/adminReports.ts bucketByWeek). Une semaine de
 * marge : le découpage par lundi se fait ensuite, à l'heure de Paris. */
export async function loadSignupDates(weeks: number, now: Date = new Date()): Promise<Date[]> {
  const rows = await db.riderProfile.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - (weeks + 1) * 7 * DAY_MS) } },
    select: { createdAt: true },
  });
  return rows.map((r) => r.createdAt);
}

/** Export CSV des comptes : de quoi suivre une cohorte dans un tableur.
 * Lecture seule, champs utiles au suivi uniquement (pas de données de
 * chevaux, de santé ni de position). */
export async function loadAccountsForExport() {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      riderProfile: {
        select: {
          onboardingCompletedAt: true,
          subscriptionStatus: true,
          billingPeriod: true,
          trialEndsAt: true,
          revenuecatId: true,
          _count: { select: { horses: true } },
        },
      },
    },
  });
}

export async function loadRedemptionsForExport() {
  return db.promoCodeRedemption.findMany({
    orderBy: { redeemedAt: "desc" },
    select: {
      status: true,
      redeemedAt: true,
      convertedAt: true,
      promoCode: { select: { code: true, campaign: true } },
      rider: { select: { user: { select: { email: true } } } },
    },
  });
}

/** Commentaires signalés, pas encore traités (cf. fil privé d'un cheval). */
export async function loadOpenCommentReports(limit = 30) {
  const reports = await db.commentReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      reason: true,
      createdAt: true,
      comment: { select: { id: true, body: true, authorRole: true, createdAt: true, author: { select: { email: true } } } },
    },
  });
  return reports;
}
