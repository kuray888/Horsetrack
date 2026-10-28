import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { loadAccountsForExport, loadPromoCodes, loadRedemptionsForExport } from "@/lib/adminData";
import { REDEMPTION_LABEL, STATUS_LABEL, toCsv } from "@/lib/adminReports";

export const dynamic = "force-dynamic";

/**
 * Exports CSV de la console (/admin/export/comptes|codes|utilisations).
 * Protégés par le middleware comme le reste de /admin, et revérifiés ici :
 * une route est un point d'entrée à part entière (cf. actions.ts).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!isAdminAuthorized(req.headers.get("authorization"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { kind } = await params;
  const csv = await build(kind);
  if (csv === null) return new NextResponse("Not found", { status: 404 });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="horsetrack-${kind}-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function build(kind: string): Promise<string | null> {
  if (kind === "comptes") {
    const users = await loadAccountsForExport();
    return toCsv(
      ["Email", "Inscrit le", "Onboarding terminé le", "Abonnement", "Formule", "Fin d'essai", "Client RevenueCat", "Chevaux", "ID"],
      users.map((u) => {
        const r = u.riderProfile;
        return [
          u.email,
          u.createdAt,
          r?.onboardingCompletedAt ?? null,
          r ? (STATUS_LABEL[r.subscriptionStatus] ?? r.subscriptionStatus) : "Inscription inachevée",
          r?.billingPeriod === "ANNUAL" ? "annuel" : r?.billingPeriod === "MONTHLY" ? "mensuel" : null,
          r?.trialEndsAt ?? null,
          r ? !!r.revenuecatId : null,
          r?._count.horses ?? 0,
          u.id,
        ];
      })
    );
  }
  if (kind === "codes") {
    const codes = await loadPromoCodes();
    return toCsv(
      ["Code", "Type", "Campagne", "Actif", "Début", "Fin", "Plafond", "Utilisations", "Premium accordé", "Déjà Premium", "Envoyés au store", "Achats confirmés"],
      codes.map((c) => [
        c.code,
        c.kind === "STORE_OFFER" ? "Offre store" : `${c.premiumDays} j de Premium`,
        c.campaign,
        c.active,
        c.startsAt,
        c.expiresAt,
        c.maxRedemptions,
        c.uses,
        c.applied,
        c.alreadyPremium,
        c.redirected,
        c.converted,
      ])
    );
  }
  if (kind === "utilisations") {
    const rows = await loadRedemptionsForExport();
    return toCsv(
      ["Code", "Campagne", "Email", "Statut", "Utilisé le", "Achat confirmé le"],
      rows.map((r) => [r.promoCode.code, r.promoCode.campaign, r.rider.user.email, REDEMPTION_LABEL[r.status] ?? r.status, r.redeemedAt, r.convertedAt])
    );
  }
  return null;
}
