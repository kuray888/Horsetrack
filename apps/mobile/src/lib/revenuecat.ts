import { Linking, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { PurchasesPackage } from "react-native-purchases";
import type { BillingPeriod } from "@/subscription/store";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type PurchasesStatic = typeof import("react-native-purchases").default;
type IntroEligibilityStatus = typeof import("react-native-purchases").INTRO_ELIGIBILITY_STATUS;

/**
 * Coupe-circuit : désactive le SDK si aucune clé API n'est configurée pour la
 * plateforme courante. En Expo Go, react-native-purchases bascule de toute
 * façon en "Preview API Mode" (cf. node_modules/react-native-purchases/dist/utils/environment.js),
 * donc la clé Test Store RevenueCat suffit pour tester le flux complet sans
 * build natif. A repasser à `true` seulement si le SDK doit être désactivé
 * temporairement (debug, incident, etc.).
 */
const TEMP_DISABLE_REVENUECAT = false;

// require() (module entier, pas juste `.default`) plutôt qu'un import statique :
// permet de ne jamais charger le module quand TEMP_DISABLE_REVENUECAT est actif,
// et donne accès à la fois à la classe Purchases et aux enums (ex.
// INTRO_ELIGIBILITY_STATUS, cf. isGrandPrixTrialEligible) sans un second
// require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const purchasesModule = TEMP_DISABLE_REVENUECAT ? null : (require("react-native-purchases") as {
  default: PurchasesStatic;
  INTRO_ELIGIBILITY_STATUS: IntroEligibilityStatus;
});
const Purchases: PurchasesStatic | null = purchasesModule?.default ?? null;

/**
 * Identifiant d'entitlement RevenueCat du palier payant unique — cf. pivot
 * tarifaire du 2026-09-03 (plus de distinction Paddock/Grand Prix). Réutilise
 * délibérément l'identifiant `grand_prix` déjà créé dans le dashboard
 * RevenueCat plutôt que d'en recréer un nouveau, pour ne pas dépendre d'une
 * reconfiguration store externe pour ce renommage de code.
 */
export const ENTITLEMENT_ID = "grand_prix";

/** Identifiants de package RevenueCat — custom (pas les `$rc_monthly`/`$rc_annual`
 * spéciaux, réservés à une offering à un seul produit) : le palier unique ×
 * 2 fréquences, à créer avec ces identifiants exacts dans le dashboard
 * RevenueCat. Plus d'add-on "cheval supplémentaire" depuis le pivot chevaux
 * illimités du 2026-09-05 (v3) — Premium n'a plus de quota à contourner. */
const PACKAGE_IDENTIFIER: Record<BillingPeriod, string> = {
  MONTHLY: "grand_prix_monthly",
  ANNUAL: "grand_prix_annual",
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
  // Les clés "test_" (Preview/Simulated Store) ne sont utilisables que dans
  // Expo Go. Le SDK natif RevenueCat fait un fatalError volontaire s'il en
  // détecte une dans un build standalone (TestFlight/App Store) — cf. crash
  // Configuration.checkForSimulatedStoreAPIKeyInRelease du 2026-07-04. Tant
  // que les vraies clés appl_/goog_ n'existent pas, on reste en simulation
  // locale hors Expo Go plutôt que de planter.
  if (apiKey.startsWith("test_") && !isExpoGo) return;

  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch (e) {
    // Sans ce catch, un échec natif ici (clé invalide, SDK non initialisable)
    // laissait `configured` à false silencieusement — le reste de l'app se
    // rabat alors sur la simulation locale (startTrial), qui n'ouvre jamais
    // le vrai écran d'achat Apple : symptôme "je clique sur s'abonner, ça
    // repart direct, pas de vrai abonnement" (cf. audit du 2026-09-09), sans
    // aucun indice de ce qui a réellement échoué.
    console.warn("[revenuecat] configure() échoué — achats indisponibles pour cette session", e);
  }
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

export async function getSubscriptionPackage(period: BillingPeriod): Promise<PurchasesPackage | null> {
  if (!configured || !Purchases) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return current.availablePackages.find((p) => p.identifier === PACKAGE_IDENTIFIER[period]) ?? null;
}

/**
 * Vérifie si le compte courant peut réellement bénéficier de l'essai gratuit
 * promis par le paywall (cf. PaywallView) — deux conditions distinctes,
 * toutes deux nécessaires :
 * 1. Le produit lui-même doit avoir une offre d'introduction configurée côté
 *    store (`product.introPrice`) : si l'offre d'essai n'existe pas dans App
 *    Store Connect / Play Console pour ce produit, personne ne l'aura jamais,
 *    quel que soit le compte.
 * 2. CE compte doit encore y être éligible : Apple n'accorde l'essai gratuit
 *    qu'une fois par groupe d'abonnement et par compte (family sharing
 *    compris) — un testeur sandbox réutilisé, ou un abonné qui revient après
 *    résiliation, est facturé immédiatement sans qu'aucun bug ne soit en
 *    cause côté app.
 * `null` = indéterminé (RevenueCat pas encore configuré, offering introuvable,
 * erreur réseau/store) : ne PAS l'interpréter comme une confirmation
 * d'éligibilité — seul `true` en est une (cf. PaywallView, qui n'affiche
 * l'essai que sur un `true`). `false` est en revanche une
 * confirmation négative fiable (offre absente du produit, ou compte non
 * éligible côté Apple) et doit systématiquement faire disparaître la promesse
 * d'essai gratuit de l'UI, pour ne jamais facturer quelqu'un à qui l'app
 * venait d'annoncer "1 mois gratuit".
 */
export async function isTrialEligible(period: BillingPeriod): Promise<boolean | null> {
  if (!configured || !Purchases) return null;
  try {
    const pkg = await getSubscriptionPackage(period);
    if (!pkg || !pkg.product.introPrice) return false;

    if (Platform.OS !== "ios") {
      // Android (Play Billing) : la présence de `introPrice` est le seul
      // signal disponible côté RevenueCat pour ce SDK — pas d'appel
      // d'éligibilité par compte équivalent à iOS.
      return true;
    }

    const statusEnum = purchasesModule?.INTRO_ELIGIBILITY_STATUS;
    if (!statusEnum) return null;
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility([pkg.product.identifier]);
    return eligibility[pkg.product.identifier]?.status === statusEnum.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
  } catch {
    // Best-effort : une erreur réseau/store ne doit pas faire planter le
    // paywall — l'appelant traite `null` comme "ne pas promettre l'essai".
    return null;
  }
}

/** Ce que le paywall affiche pour une fréquence : tout vient du store quand
 * il répond (prix localisé, durée réelle de l'essai), jamais d'une constante. */
export type PaywallPlanInfo = {
  price: number;
  priceString: string;
  pricePerMonthString: string | null;
  /** true = essai confirmé ; false = pas d'essai ; null = indéterminé, à
   * traiter comme « pas d'essai » (on ne promet que ce qui est confirmé). */
  trialEligible: boolean | null;
  trialUnit: string | null;
  trialCount: number | null;
};

export type PaywallOffer = Partial<Record<BillingPeriod, PaywallPlanInfo>>;

/** Charge les deux formules en un seul passage (offerings + éligibilité).
 * `{}` si RevenueCat n'est pas disponible — l'appelant retombe alors sur ses
 * prix de repli et ne promet aucun essai. */
export async function loadPaywallOffer(): Promise<PaywallOffer> {
  if (!configured || !Purchases) return {};
  const periods: BillingPeriod[] = ["MONTHLY", "ANNUAL"];
  const entries = await Promise.all(
    periods.map(async (period): Promise<[BillingPeriod, PaywallPlanInfo] | null> => {
      try {
        const pkg = await getSubscriptionPackage(period);
        if (!pkg) return null;
        const intro = pkg.product.introPrice;
        const isFreeTrial = !!intro && intro.price === 0;
        return [
          period,
          {
            price: pkg.product.price,
            priceString: pkg.product.priceString,
            pricePerMonthString: pkg.product.pricePerMonthString ?? null,
            trialEligible: isFreeTrial ? await isTrialEligible(period) : false,
            trialUnit: isFreeTrial ? intro.periodUnit : null,
            trialCount: isFreeTrial ? intro.periodNumberOfUnits : null,
          },
        ];
      } catch {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter((e): e is [BillingPeriod, PaywallPlanInfo] => e !== null));
}

/** Ouvre la gestion d'abonnement du store (changer de formule, résilier).
 * Repli sur l'URL publique si le SDK n'est pas disponible. */
export async function openManageSubscriptions(): Promise<void> {
  if (configured && Purchases) {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // repli ci-dessous
    }
  }
  const url =
    Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  await Linking.openURL(url).catch(() => {});
}

export { Purchases };
