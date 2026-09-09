import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CustomerInfo } from "react-native-purchases";
import { supabase } from "@/lib/supabase";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { withKeyLock } from "@/lib/keyLock";
import {
  ENTITLEMENT_ID,
  Purchases,
  configurePurchases,
  getSubscriptionPackage,
  isPurchasesAvailable,
  loginRevenueCat,
  logoutRevenueCat,
} from "@/lib/revenuecat";
import {
  DEFAULT_SUBSCRIPTION_STATE as DEFAULT,
  computeIsActiveOrTrialing,
  FREE_HORSE_LIMIT,
  maxHorses,
} from "./logic";
import type { SubscriptionStatus, BillingPeriod, Persisted } from "./logic";

/**
 * Entitlement d'abonnement, global à l'app. Pilote le gating de toute l'app
 * (cf. composant <Locked>) — depuis le pivot freemium du 2026-09-03 (v2), puis
 * le pivot chevaux illimités du 2026-09-05 (v3) : un palier gratuit permanent
 * (1 cheval, agenda/planning/journal/dépenses de base) et un palier Premium
 * payant à chevaux ILLIMITÉS (partage, coffre-fort, concours multi-épreuves,
 * rappels automatiques) — plus de concept d'add-on "cheval supplémentaire",
 * cf. rls.sql rider_is_active_or_trialing pour l'équivalent côté base.
 *
 * Tant que le projet RevenueCat + les produits store ne sont pas créés
 * (cf. apps/mobile/.env), `isPurchasesAvailable()` reste false et on retombe
 * sur une simulation locale (SecureStore) identique au comportement d'avant
 * — à supprimer une fois les achats réels opérationnels.
 *
 * Valeurs alignées sur l'enum Prisma SubscriptionStatus / BillingPeriod
 * (+ 'free' = jamais abonné). La logique pure (calcul du statut effectif,
 * limite de chevaux) vit dans ./logic.ts, testée séparément.
 */
export type { SubscriptionStatus, BillingPeriod, Persisted };
export { FREE_HORSE_LIMIT, maxHorses, computeIsActiveOrTrialing };

const KEY = "subscription_state_v1";

type SubscriptionContextValue = Persisted & {
  /** true tant qu'un abonnement Premium (actif ou en essai) couvre le
   * compte — gate des fonctionnalités payantes uniquement, cf. <Locked>. */
  isActiveOrTrialing: boolean;
  loading: boolean;
  /** Démarre l'essai Premium d'1 mois en mode simulation locale (utilisé
   * seulement si RevenueCat n'est pas encore configuré, cf. useSubscribeFlow). */
  startTrial: (period: BillingPeriod) => Promise<void>;
  refresh: () => Promise<void>;
  applyCustomerInfo: (info: CustomerInfo) => void;
  /** Valide et applique un code promo — validation exclusivement côté serveur
   * (cf. apps/api/src/app/api/promo/redeem/route.ts), jamais sur la seule foi
   * de la valeur saisie ici. */
  redeemPromoCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  /** Efface l'état d'abonnement local + déconnecte RevenueCat (cf. suppression
   * de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/** Best-effort : le SKU exact dépend des produits créés dans App Store Connect
 * / Play Console (pas encore le cas) — à remplacer par un mapping exact une
 * fois ces identifiants connus. */
function billingPeriodFromProductId(productId: string): BillingPeriod | null {
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return null;
}

function persistedFromCustomerInfo(info: CustomerInfo): Persisted {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return { ...DEFAULT };

  const billingPeriod = billingPeriodFromProductId(entitlement.productIdentifier);
  if (entitlement.periodType === "TRIAL") {
    return { status: "trialing", billingPeriod, trialEndsAt: entitlement.expirationDate };
  }
  return { status: "active", billingPeriod, trialEndsAt: null };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const persistLocal = useCallback(async (next: Persisted) => {
    // Sérialisé (cf. lib/keyLock) : cette écriture et le `clearAll` déclenché
    // en parallèle par (auth)/login.tsx ciblent la même clé Keychain — cf.
    // onAuthStateChange plus bas.
    await withKeyLock(KEY, () => SecureStore.setItemAsync(KEY, JSON.stringify(next)));
    setState(next);
  }, []);

  const applyCustomerInfo = useCallback(
    (info: CustomerInfo) => {
      persistLocal(persistedFromCustomerInfo(info)).catch((e) => console.warn("[subscription] persistLocal échoué", e));
    },
    [persistLocal]
  );

  const refreshFromRevenueCat = useCallback(async () => {
    // Sérialisé (cf. lib/keyLock) : `loginRevenueCat` ici et `logoutRevenueCat`
    // dans clearAll ci-dessous peuvent être déclenchés à quelques
    // millisecondes d'écart par SIGNED_IN vs (auth)/login.tsx — deux appels
    // simultanés sur le même "current user" du SDK RevenueCat autrement.
    await withKeyLock("revenuecat", async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) await loginRevenueCat(data.user.id);
      // Non-null : on n'arrive ici que si isPurchasesAvailable() est true (cf. refresh()).
      const info = await Purchases!.getCustomerInfo();
      applyCustomerInfo(info);
    });
  }, [applyCustomerInfo]);

  const refreshFromLocalCache = useCallback(async () => {
    const parsed = await withKeyLock(KEY, async () => {
      const raw = await SecureStore.getItemAsync(KEY);
      const next: Persisted = { ...DEFAULT, ...safeJsonParse<Partial<Persisted>>(raw, {}) };
      // expiration de l'essai simulé gérée localement
      if (next.status === "trialing" && next.trialEndsAt && !computeIsActiveOrTrialing(next)) {
        next.status = "expired";
        await SecureStore.setItemAsync(KEY, JSON.stringify(next));
      }
      return next;
    });
    setState(parsed);
  }, []);

  const refresh = useCallback(async () => {
    try {
      configurePurchases();
      if (isPurchasesAvailable()) {
        try {
          await refreshFromRevenueCat();
          return;
        } catch (e) {
          // Échec réseau/RevenueCat au lancement : sans ce repli, `state`
          // restait à DEFAULT ("free") — un abonné Premium hors ligne au
          // démarrage se voyait donc paywallé jusqu'au prochain lancement en
          // ligne, sans le moindre message (cf. audit du 2026-09-09). On
          // retombe sur le dernier état confirmé, déjà en cache local.
          console.warn("[subscription] refreshFromRevenueCat échoué, repli sur le dernier état connu", e);
        }
      }
      await refreshFromLocalCache();
    } finally {
      setLoading(false);
    }
  }, [refreshFromRevenueCat, refreshFromLocalCache]);

  useEffect(() => {
    // `finally` ci-dessus garantit déjà setLoading(false) dans tous les cas —
    // ce `.catch` n'est là que pour ne pas laisser un rejet non géré si
    // refreshFromRevenueCat()/refreshFromLocalCache() échoue (réseau, RC),
    // seul appelant de refresh() qui ne l'attend pas lui-même.
    refresh().catch(() => {});

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isPurchasesAvailable()) return;
      if (event === "SIGNED_IN" && session?.user) {
        withKeyLock("revenuecat", () => loginRevenueCat(session.user.id))
          .then(refreshFromRevenueCat)
          .catch((e) => console.warn("[subscription] loginRevenueCat/refresh échoué", e));
      } else if (event === "SIGNED_OUT") {
        withKeyLock("revenuecat", () => logoutRevenueCat())
          .then(() => persistLocal(DEFAULT))
          .catch((e) => console.warn("[subscription] logoutRevenueCat échoué", e));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, refreshFromRevenueCat, persistLocal]);

  /** Simulation locale (1 mois), utilisée uniquement tant que RevenueCat
   * n'est pas configuré — cf. useSubscribeFlow. */
  const startTrial = useCallback(
    async (period: BillingPeriod) => {
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await persistLocal({ status: "trialing", billingPeriod: period, trialEndsAt });
    },
    [persistLocal]
  );

  /** Le serveur seul décide de la validité/durée (cf. sa doc) — ce client se
   * contente d'envoyer le code saisi et d'appliquer le résultat renvoyé
   * (trialEndsAt), jamais une valeur devinée ou calculée ici. */
  const redeemPromoCode = useCallback(async (code: string): Promise<{ ok: boolean; message: string }> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, message: "Connecte-toi pour utiliser un code promo." };
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/promo/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: json?.error ?? "Ce code promo n'est pas valide." };
      if (json.applied && json.trialEndsAt) {
        await persistLocal({ status: "trialing", billingPeriod: null, trialEndsAt: json.trialEndsAt });
      }
      return { ok: true, message: json.message ?? "Code appliqué !" };
    } catch {
      return { ok: false, message: "Impossible de vérifier ce code pour le moment." };
    }
  }, [persistLocal]);

  const clearAll = useCallback(async () => {
    // Best-effort comme les deux autres appels logIn/logOut de ce fichier
    // (cf. onAuthStateChange ci-dessus) — jamais rejeté. Sans ce `.catch`,
    // le SDK RevenueCat rejette avec "LogOut was called but the current user
    // is anonymous" dès que ce compte n'a encore jamais été identifié côté
    // RevenueCat (ex: changement de compte sur un appareil avant que le
    // SIGNED_IN précédent n'ait eu le temps d'appeler loginRevenueCat) —
    // resterait alors non catché par l'appelant (cf. clearSubscription dans
    // (auth)/login.tsx et (onboarding)/account.tsx), qui ne fait que vider
    // l'état RevenueCat local avant de restaurer un autre compte.
    if (isPurchasesAvailable()) await withKeyLock("revenuecat", () => logoutRevenueCat()).catch(() => {});
    // Sérialisé (cf. lib/keyLock) : même clé que persistLocal/refreshFromLocalCache
    // ci-dessus, potentiellement en vol au même instant via l'écouteur SIGNED_IN.
    await withKeyLock(KEY, () => SecureStore.deleteItemAsync(KEY));
    setState(DEFAULT);
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      ...state,
      isActiveOrTrialing: computeIsActiveOrTrialing(state),
      loading,
      startTrial,
      refresh,
      applyCustomerInfo,
      redeemPromoCode,
      clearAll,
    }),
    [state, loading, startTrial, refresh, applyCustomerInfo, redeemPromoCode, clearAll]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription doit être utilisé dans <SubscriptionProvider>");
  return ctx;
}

/**
 * Logique d'achat partagée par les écrans paywall (onboarding et celui
 * déclenché par <Locked>), pour qu'elle ne soit écrite qu'à un seul endroit.
 */
export function useSubscribeFlow() {
  const { startTrial, applyCustomerInfo } = useSubscription();
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const subscribe = useCallback(
    async (period: BillingPeriod, onSuccess: () => void | Promise<void>) => {
      setSubmitting(true);
      try {
        if (!isPurchasesAvailable()) {
          // RevenueCat pas encore configuré (.env vide) : simulation locale,
          // identique au comportement avant le branchement RevenueCat.
          await startTrial(period);
          await onSuccess();
          return;
        }

        const pkg = await getSubscriptionPackage(period);
        if (!pkg) {
          Alert.alert("Indisponible", "Cette offre n'est pas encore configurée. Réessaie plus tard.");
          return;
        }
        // Non-null : isPurchasesAvailable() a déjà été vérifié plus haut dans ce bloc.
        const { customerInfo } = await Purchases!.purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        await onSuccess();
      } catch (e) {
        if ((e as { userCancelled?: boolean })?.userCancelled) return;
        Alert.alert(
          "Oups",
          "Impossible de finaliser l'achat. Vérifie ta connexion et réessaie — si le problème persiste, la boutique est peut-être temporairement indisponible."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [startTrial, applyCustomerInfo]
  );

  const restore = useCallback(async () => {
    if (!isPurchasesAvailable()) {
      Alert.alert("Indisponible", "La restauration des achats sera possible une fois les abonnements activés.");
      return;
    }
    setRestoring(true);
    try {
      // Non-null : isPurchasesAvailable() vérifié juste au-dessus.
      const info = await Purchases!.restorePurchases();
      applyCustomerInfo(info);
      const hasEntitlement = !!info.entitlements.active[ENTITLEMENT_ID];
      Alert.alert(hasEntitlement ? "Abonnement restauré" : "Rien à restaurer", hasEntitlement ? "" : "Aucun achat actif trouvé pour ce compte.");
    } catch {
      Alert.alert("Oups", "Impossible de restaurer tes achats pour l'instant. Vérifie ta connexion et réessaie.");
    } finally {
      setRestoring(false);
    }
  }, [applyCustomerInfo]);

  return { submitting, subscribe, restoring, restore };
}
