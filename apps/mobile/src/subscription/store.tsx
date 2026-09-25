import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CustomerInfo } from "react-native-purchases";
import { supabase } from "@/lib/supabase";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { withKeyLock } from "@/lib/keyLock";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { track } from "@/lib/analytics";
import { invalidatePaywallOffer } from "./paywall";
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
  startTrial: (period: BillingPeriod) => Promise<Persisted>;
  refresh: () => Promise<void>;
  applyCustomerInfo: (info: CustomerInfo) => Promise<void>;
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

  /** Dernier état CONFIRMÉ, relu depuis le stockage sécurisé — pour
   * `applyCustomerInfo` ci-dessous. Volontairement PAS `state` ni une ref sur
   * lui : au lancement, `state` vaut encore DEFAULT ("free") tant que le
   * premier chargement n'a pas abouti, et `refresh()` interroge RevenueCat
   * AVANT d'avoir lu quoi que ce soit (cf. son ordre) ; l'écouteur SIGNED_IN
   * peut par ailleurs déclencher applyCustomerInfo à tout moment. Le stockage
   * est la seule source de vérité qui ne dépend d'aucun de ces ordonnancements. */
  const readPersisted = useCallback(async (): Promise<Persisted> => {
    const raw = await withKeyLock(KEY, () => SecureStore.getItemAsync(KEY));
    return { ...DEFAULT, ...safeJsonParse<Partial<Persisted>>(raw, {}) };
  }, []);

  /** Essai par code promo connu du SERVEUR mais pas de cet appareil : nouvel
   * iPhone, réinstallation, autre appareil. Le code n'est utilisable qu'une
   * fois (« déjà utilisé »), et rien d'autre ne recopie l'essai serveur
   * (rider_profiles.subscriptionStatus/trialEndsAt) vers l'app — sans ça, le
   * serveur traitait le compte en Premium (quota de chevaux, coffre-fort)
   * pendant que l'app le croyait gratuit et le paywallait pour toute la durée
   * de l'essai. N'adopte que un essai ENCORE en cours ; jamais « actif » (un
   * abonnement que RevenueCat ne voit plus peut être résilié, le webhook en
   * retard). Best-effort : renvoie null au moindre doute. */
  const readServerTrial = useCallback(async (): Promise<{ trial: Persisted; userId: string } | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const userId = userData.user.id;
      const { data, error } = await supabase
        .from("rider_profiles")
        .select("subscriptionStatus, trialEndsAt")
        .eq("userId", userId)
        .maybeSingle();
      if (error || !data || data.subscriptionStatus !== "TRIALING" || !data.trialEndsAt) return null;
      const trial: Persisted = {
        status: "trialing",
        billingPeriod: null,
        trialEndsAt: new Date(data.trialEndsAt).toISOString(),
      };
      // `userId` est rendu à l'appelant pour qu'il vérifie, au moment d'écrire,
      // que c'est toujours ce compte qui est connecté.
      return computeIsActiveOrTrialing(trial) ? { trial, userId } : null;
    } catch {
      return null;
    }
  }, []);

  const applyCustomerInfo = useCallback(
    async (info: CustomerInfo) => {
      const next = persistedFromCustomerInfo(info);
      try {
        // Un vrai achat/essai Apple vu par RevenueCat est toujours prioritaire :
        // il écrase l'état local sans autre question.
        if (next.status !== "free") {
          await persistLocal(next);
          return;
        }
        // RevenueCat ne voit rien. Un code promo (redeemPromoCode plus bas)
        // accorde pourtant un essai directement en base
        // (rider_profiles.subscriptionStatus/trialEndsAt côté serveur), sans
        // jamais passer par RevenueCat/Apple — marqué localement par
        // `billingPeriod: null` (seule valeur que redeemPromoCode écrit).
        // RevenueCat répond donc "aucun entitlement actif" à CHAQUE lancement
        // (cf. refresh()) : sans cette garde, `next` valait {status:"free",...}
        // et écrasait aussitôt l'essai promo en local — dès le lancement
        // suivant, potentiellement le jour même de son activation, bien avant
        // sa vraie date d'expiration (cf. audit du 2026-09-18).
        const current = await readPersisted();
        const hasValidPromoTrial =
          current.status === "trialing" && current.billingPeriod === null && computeIsActiveOrTrialing(current);
        if (hasValidPromoTrial) {
          // Rien à réécrire — mais il faut refléter l'essai dans l'état React,
          // qui vaut encore DEFAULT au lancement : sans ce setState, l'essai
          // survivait en Keychain tout en paywallant l'utilisateur pendant
          // toute la session.
          setState(current);
          return;
        }
        await persistLocal(next);
        // Rien de local ni chez RevenueCat : le serveur connaît peut-être un
        // essai par code promo (cf. readServerTrial). Sans attendre — cette
        // lecture réseau ne doit pas retarder le lancement de tous les comptes
        // gratuits — et sans jamais écraser un état devenu Premium entre-temps
        // (achat en cours, autre refresh).
        readServerTrial()
          .then(async (found) => {
            if (!found) return;
            // Le compte a pu changer pendant ces deux appels réseau
            // (déconnexion, bascule vers un autre compte sur le même appareil —
            // la même course que withKeyLock règle pour le Keychain). Écrire
            // sans revérifier donnait l'essai d'un compte à un autre, et la
            // garde anti-écrasement ci-dessus le lui conservait ensuite à
            // chaque lancement, jusqu'à sa date de fin.
            const { data: current } = await supabase.auth.getUser();
            if (current.user?.id !== found.userId) return;
            const latest = await readPersisted();
            if (computeIsActiveOrTrialing(latest)) return;
            await persistLocal(found.trial);
          })
          .catch((e) => console.warn("[subscription] restauration de l'essai promo échouée", e));
      } catch (e) {
        console.warn("[subscription] applyCustomerInfo échoué", e);
      }
    },
    [persistLocal, readPersisted, readServerTrial]
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
      await applyCustomerInfo(info);
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
      // L'éligibilité à l'essai est propre à chaque compte.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") invalidatePaywallOffer();
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
    async (period: BillingPeriod): Promise<Persisted> => {
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const next: Persisted = { status: "trialing", billingPeriod: period, trialEndsAt };
      await persistLocal(next);
      return next;
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
    track("promo_code_submitted");
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/promo/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => null);
      track("promo_code_result", { ok: res.ok, applied: !!json?.applied });
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
    // + best-effort (cf. audit crash SecureStore Apple Sign In du 2026-09-09) :
    // ce delete tourne dans le Promise.all de
    // (auth)/login.tsx.afterSuccessfulAuth, un rejet non catché ici plantait
    // tout le groupe.
    await withKeyLock(KEY, () => SecureStore.deleteItemAsync(KEY)).catch(() => {});
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
  // `onSuccess` (cf. subscribe ci-dessous) navigue systématiquement ailleurs
  // (paywall.tsx finish() : router.replace vers (tabs)/today, ou fermeture du
  // paywall app) avant que ce hook ne reprenne la main dans `finally` — cet
  // écran-ci peut donc déjà être démonté au moment de setSubmitting(false)/
  // setRestoring(false). Un setState après démontage n'est normalement qu'un
  // avertissement React, jamais un crash à lui seul, mais reste un état
  // incohérent à éviter proprement plutôt qu'à laisser au hasard du timing
  // (cf. audit du crash de fin d'onboarding du 2026-09-11, cause exacte
  // non confirmée faute de trace Sentry).
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const subscribe = useCallback(
    async (
      period: BillingPeriod,
      onSuccess: (persisted: Persisted) => void | Promise<void>,
      /** Contexte d'ouverture du paywall, pour les événements analytics. */
      placement: string = "unknown"
    ) => {
      setSubmitting(true);
      track("purchase_started", { period, placement });
      try {
        if (!isPurchasesAvailable()) {
          // La simulation locale (30 jours de Premium accordés sans aucun
          // paiement) est un outil de DÉVELOPPEMENT, jamais un repli
          // acceptable dans une app publiée.
          //
          // Sur Android elle se déclenchait pour tout le monde : la clé
          // RevenueCat Android est encore une clé Test Store ("test_…"), que
          // lib/revenuecat.ts refuse hors Expo Go — `configurePurchases` ne
          // configure donc rien, `isPurchasesAvailable()` reste false, et ce
          // bloc offrait Premium gratuitement à chaque installation. Le
          // serveur, lui, ne voit aucun abonnement (cf. le webhook RevenueCat
          // et les règles RLS) : l'app affichait Premium pendant que toutes
          // les écritures Premium étaient rejetées.
          //
          // Le même piège existe sur iOS dès que `Purchases.configure()`
          // échoue (clé invalide, SDK non initialisable — cf. le catch de
          // configurePurchases) : mieux vaut un message honnête qu'un faux
          // Premium que le serveur ne reconnaîtra jamais.
          if (__DEV__) {
            const persisted = await startTrial(period);
            track("purchase_completed", { period, placement, status: persisted.status, simulated: true });
            await onSuccess(persisted);
            return;
          }
          track("purchase_failed", { period, placement, reason: "purchases_unavailable" });
          Alert.alert(
            "Abonnement indisponible",
            "L'abonnement n'est pas disponible sur cet appareil pour le moment. Vérifie ta connexion et réessaie — si le problème persiste, réessaie un peu plus tard."
          );
          return;
        }

        const pkg = await getSubscriptionPackage(period);
        if (!pkg) {
          track("purchase_failed", { period, placement, reason: "package_missing" });
          Alert.alert("Indisponible", "Cette offre n'est pas encore configurée. Réessaie plus tard.");
          return;
        }
        // Non-null : isPurchasesAvailable() a déjà été vérifié plus haut dans ce bloc.
        // `runNativeInteraction` : l'écran de paiement du Play Store est une
        // activité Android distincte, qui rejouerait sinon le verrou
        // biométrique en plein achat (cf. lib/nativeInteraction.ts). Sans
        // effet sur iOS.
        const { customerInfo } = await runNativeInteraction(() => Purchases!.purchasePackage(pkg));
        // On calcule le résultat de l'achat ici plutôt que de laisser l'appelant
        // relire `subscription` (cf. useSubscription()) : applyCustomerInfo()
        // ci-dessous ne fait que programmer un re-render, donc toute closure
        // déjà capturée côté appelant (ex. finish() de l'onboarding, créée au
        // rendu précédent l'achat) resterait sur l'ancien statut (souvent
        // "free") au moment de son exécution — bug constaté : chevaux ajoutés
        // pendant l'onboarding supprimés juste après un abonnement Premium
        // réussi, car maxHorses() lisait encore l'état pré-achat.
        const persisted = persistedFromCustomerInfo(customerInfo);
        track("purchase_completed", { period, placement, status: persisted.status });
        // L'éligibilité à l'essai vient d'être consommée : l'offre en cache
        // (cf. usePaywallOffer) ne doit plus la promettre.
        invalidatePaywallOffer();
        await applyCustomerInfo(customerInfo);
        await onSuccess(persisted);
      } catch (e) {
        if ((e as { userCancelled?: boolean })?.userCancelled) {
          track("purchase_cancelled", { period, placement });
          return;
        }
        track("purchase_failed", { period, placement, reason: "store_error" });
        Alert.alert(
          "Oups",
          "Impossible de finaliser l'achat. Vérifie ta connexion et réessaie — si le problème persiste, la boutique est peut-être temporairement indisponible."
        );
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [startTrial, applyCustomerInfo]
  );

  const restore = useCallback(async () => {
    track("restore_tapped");
    if (!isPurchasesAvailable()) {
      Alert.alert("Indisponible", "La restauration des achats sera possible une fois les abonnements activés.");
      return;
    }
    setRestoring(true);
    try {
      // Non-null : isPurchasesAvailable() vérifié juste au-dessus.
      // `runNativeInteraction` : cf. `subscribe` ci-dessus.
      const info = await runNativeInteraction(() => Purchases!.restorePurchases());
      await applyCustomerInfo(info);
      const hasEntitlement = !!info.entitlements.active[ENTITLEMENT_ID];
      track("restore_completed", { restored: hasEntitlement });
      invalidatePaywallOffer();
      Alert.alert(hasEntitlement ? "Abonnement restauré" : "Rien à restaurer", hasEntitlement ? "" : "Aucun achat actif trouvé pour ce compte.");
    } catch {
      Alert.alert("Oups", "Impossible de restaurer tes achats pour l'instant. Vérifie ta connexion et réessaie.");
    } finally {
      if (mountedRef.current) setRestoring(false);
    }
  }, [applyCustomerInfo]);

  return { submitting, subscribe, restoring, restore };
}
