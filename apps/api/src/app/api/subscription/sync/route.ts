import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { fetchEntitlementState } from "@/lib/revenuecatApi";
import { applyEntitlementState } from "@/lib/subscriptionSync";

/**
 * Resynchronise le statut Premium de l'appelant depuis RevenueCat — appelé par
 * l'app quand RevenueCat lui dit que le compte est Premium (cf. mobile
 * lib/subscriptionSync.ts). Filet du webhook : un événement perdu ou non
 * traité (octroi promotionnel avant correctif, TRANSFER, profil créé après
 * l'achat…) laissait le serveur refuser en silence chevaux, coffre-fort et
 * séances d'un compte que l'app affichait Premium (cf. audit du 2026-09-30).
 *
 * Sûr : l'état vient exclusivement de RevenueCat (clé secrète serveur), jamais
 * de l'app ; l'appelant ne peut synchroniser que SON compte. Ne rétrograde
 * jamais (c'est le rôle de l'événement EXPIRATION) : un appel ne peut
 * qu'accorder un accès que RevenueCat confirme.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const state = await fetchEntitlementState(userId);
  // Clé absente ou RevenueCat injoignable : rien d'appris, rien d'écrit.
  if (!state) return NextResponse.json({ synced: false });

  const outcome = await applyEntitlementState(userId, state, { allowDowngrade: false });
  // `no-profile` : ligne pas encore créée (onboarding en cours) — l'app
  // retentera une fois son profil envoyé.
  return NextResponse.json({ synced: outcome !== "no-profile", active: state.active, outcome });
}
