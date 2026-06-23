import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import type { SubscriptionPlan } from "@/subscription/store";

/**
 * Identifiant d'entitlement RevenueCat qui débloque l'accès premium — doit
 * correspondre exactement à l'entitlement créé dans le dashboard RevenueCat.
 */
export const ENTITLEMENT_ID = "premium";

/** Identifiants de package RevenueCat (convention par défaut d'une Offering
 * "Monthly + Annual") — à ajuster si les packages créés dans le dashboard
 * portent d'autres identifiants. */
const PACKAGE_IDENTIFIER: Record<SubscriptionPlan, string> = {
  MONTHLY: "$rc_monthly",
  ANNUAL: "$rc_annual",
};

let configured = false;

/**
 * Configure le SDK une seule fois au démarrage. No-op si la clé API pour la
 * plateforme courante n'est pas encore renseignée (.env) — tant que le projet
 * RevenueCat et les produits store ne sont pas créés, isAvailable() restera
 * false et le reste de l'app doit se comporter comme si l'achat n'était pas
 * disponible plutôt que de planter.
 */
export function configurePurchases(): void {
  if (configured) return;
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!apiKey) return;

  Purchases.configure({ apiKey });
  configured = true;
}

export function isPurchasesAvailable(): boolean {
  return configured;
}

/** Lie l'utilisateur RevenueCat à l'utilisateur Supabase — à appeler dès
 * qu'une session existe, pour que le webhook RevenueCat (app_user_id) puisse
 * retrouver le bon rider_profile côté backend. */
export async function loginRevenueCat(supabaseUserId: string): Promise<void> {
  if (!configured) return;
  await Purchases.logIn(supabaseUserId);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!configured) return;
  await Purchases.logOut();
}

export async function getPackageForPlan(plan: SubscriptionPlan): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return (
    current.availablePackages.find((p) => p.identifier === PACKAGE_IDENTIFIER[plan]) ?? null
  );
}

export { Purchases };
