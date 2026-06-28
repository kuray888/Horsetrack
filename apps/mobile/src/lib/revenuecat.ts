import { Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import type { BillingPeriod, SubscriptionTier } from "@/subscription/store";

type PurchasesStatic = typeof import("react-native-purchases").default;

/** Palier payant — FREE n'a pas de produit RevenueCat associé. */
export type PaidTier = Exclude<SubscriptionTier, "FREE">;

/**
 * Coupe-circuit : désactive le SDK si aucune clé API n'est configurée pour la
 * plateforme courante. En Expo Go, react-native-purchases bascule de toute
 * façon en "Preview API Mode" (cf. node_modules/react-native-purchases/dist/utils/environment.js),
 * donc la clé Test Store RevenueCat suffit pour tester le flux complet sans
 * build natif. A repasser à `true` seulement si le SDK doit être désactivé
 * temporairement (debug, incident, etc.).
 */
const TEMP_DISABLE_REVENUECAT = false;

// require() plutôt qu'un import statique : permet de ne jamais charger le
// module quand TEMP_DISABLE_REVENUECAT est actif, sans dépendre du SDK.
const Purchases: PurchasesStatic | null = TEMP_DISABLE_REVENUECAT
  ? null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : (require("react-native-purchases").default as PurchasesStatic);

/**
 * Identifiants d'entitlement RevenueCat — doivent correspondre exactement aux
 * entitlements créés dans le dashboard RevenueCat. Le produit Grand Prix doit
 * être rattaché aux DEUX entitlements `paddock` et `grand_prix` (Grand Prix
 * est un sur-ensemble de Paddock), Paddock uniquement à `paddock`.
 */
export const ENTITLEMENT_ID: Record<PaidTier, string> = {
  PADDOCK: "paddock",
  GRAND_PRIX: "grand_prix",
};
export const EXTRA_HORSE_ENTITLEMENT_ID = "extra_horse";

/** Identifiants de package RevenueCat — custom (pas les `$rc_monthly`/`$rc_annual`
 * spéciaux, réservés à une offering à un seul produit) : 2 paliers × 2
 * fréquences + l'add-on × 2 fréquences, à créer avec ces identifiants exacts
 * dans le dashboard RevenueCat. */
const PACKAGE_IDENTIFIER: Record<PaidTier, Record<BillingPeriod, string>> = {
  PADDOCK: { MONTHLY: "paddock_monthly", ANNUAL: "paddock_annual" },
  GRAND_PRIX: { MONTHLY: "grand_prix_monthly", ANNUAL: "grand_prix_annual" },
};
const ADDON_PACKAGE_IDENTIFIER: Record<BillingPeriod, string> = {
  MONTHLY: "extra_horse_monthly",
  ANNUAL: "extra_horse_annual",
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
  if (configured || !Purchases) return;
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
  if (!configured || !Purchases) return;
  await Purchases.logIn(supabaseUserId);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!configured || !Purchases) return;
  await Purchases.logOut();
}

export async function getPackageForTier(
  tier: PaidTier,
  period: BillingPeriod
): Promise<PurchasesPackage | null> {
  if (!configured || !Purchases) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return current.availablePackages.find((p) => p.identifier === PACKAGE_IDENTIFIER[tier][period]) ?? null;
}

export async function getAddonPackage(period: BillingPeriod): Promise<PurchasesPackage | null> {
  if (!configured || !Purchases) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return current.availablePackages.find((p) => p.identifier === ADDON_PACKAGE_IDENTIFIER[period]) ?? null;
}

export { Purchases };
