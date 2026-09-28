import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { isPurchasesAvailable, loadPaywallOffer, type PaywallOffer } from "@/lib/revenuecat";
import { track } from "@/lib/analytics";
import type { PaywallPlacement } from "./paywallLogic";

/**
 * Ouvre le paywall de l'app en lui passant son contexte (`from`), qui pilote
 * le titre et l'ordre des bénéfices (cf. paywallLogic.paywallCopy) et la
 * propriété `placement` des événements analytics. Point d'entrée unique :
 * plus aucun `router.push("/paywall")` nu dans l'app.
 */
export function openPaywall(placement: PaywallPlacement, extra: { feature?: string; horseId?: string } = {}): void {
  router.push({ pathname: "/paywall", params: { from: placement, ...(extra.horseId ? { horseId: extra.horseId } : {}) } });
  if (extra.feature) track("locked_feature_tapped", { feature: extra.feature, placement });
}

const OFFER_TIMEOUT_MS = 6000;

/** Offre de repli en développement sans RevenueCat : reflète la simulation
 * locale d'essai d'1 mois (cf. useSubscribeFlow, __DEV__ uniquement) pour
 * pouvoir relire le paywall complet dans Expo Go. */
const DEV_OFFER: PaywallOffer = {
  MONTHLY: { price: 3.99, priceString: "3,99 €", currencyCode: "EUR", storefrontCountry: "FRA", pricePerMonthString: "3,99 €", trialEligible: true, trialUnit: "MONTH", trialCount: 1 },
  ANNUAL: { price: 39.99, priceString: "39,99 €", currencyCode: "EUR", storefrontCountry: "FRA", pricePerMonthString: "3,33 €", trialEligible: true, trialUnit: "MONTH", trialCount: 1 },
};

let cached: Promise<PaywallOffer> | null = null;

function fetchOffer(): Promise<PaywallOffer> {
  if (!isPurchasesAvailable()) return Promise.resolve(__DEV__ ? DEV_OFFER : {});
  const timeout = new Promise<PaywallOffer>((resolve) => setTimeout(() => resolve({}), OFFER_TIMEOUT_MS));
  return Promise.race([loadPaywallOffer().catch(() => ({})), timeout]);
}

/** Relit l'offre au prochain affichage — à appeler après un achat, une
 * restauration ou un changement de compte (l'éligibilité à l'essai change). */
export function invalidatePaywallOffer(): void {
  cached = null;
}

// L'offre reste en cache pour toute la durée du process JS (cf. `cached`
// ci-dessus), donc jusqu'ici seulement invalidée par un événement précis
// (connexion/achat/restauration). Un changement fait EN DEHORS de l'app —
// pays du compte Apple modifié dans Réglages, changement de compte sandbox —
// ne déclenche aucun de ces événements : le paywall pouvait alors garder un
// prix/une devise périmés tant que l'app restait en mémoire (repéré : prix
// affiché en $ alors que la fiche d'achat Apple, elle, interroge le store à
// chaque fois et affichait correctement le prix en €) — cf. la remontée du
// 2026-09-27. On invalide donc aussi à chaque retour au premier plan —
// RevenueCat garde son propre cache léger côté SDK, ce n'est jamais un
// aller-retour réseau à vide.
AppState.addEventListener("change", (next) => {
  if (next === "active") invalidatePaywallOffer();
});

function getOffer(): Promise<PaywallOffer> {
  if (!cached) {
    cached = fetchOffer().then((offer) => {
      // Un résultat vide (réseau, store muet) n'est pas mis en cache : on
      // retentera au prochain affichage plutôt que de rester sans prix réels.
      if (Object.keys(offer).length === 0) cached = null;
      return offer;
    });
  }
  return cached;
}

/** `undefined` tant que l'offre charge (l'UI n'affiche alors ni prix
 * définitif ni promesse d'essai), puis l'offre — éventuellement vide.
 * `retry` relance le chargement (offre vide : store injoignable). */
export function usePaywallOfferState(): { offer: PaywallOffer | undefined; retry: () => void } {
  const [offer, setOffer] = useState<PaywallOffer | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    getOffer().then((o) => {
      if (cancelled) return;
      setOffer(o);
      // Monté avant la configuration de RevenueCat (premier écran au
      // démarrage, cf. SubscriptionProvider.refresh) : une seconde lecture un
      // peu plus tard, sinon un verrou resterait sur « Découvrir Premium »
      // alors que l'essai est disponible.
      if (Object.keys(o).length === 0 && !isPurchasesAvailable()) {
        retry = setTimeout(() => {
          getOffer().then((again) => {
            if (!cancelled) setOffer(again);
          });
        }, 2000);
      }
    });
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [attempt]);
  return {
    offer,
    retry: () => {
      invalidatePaywallOffer();
      setOffer(undefined);
      setAttempt((n) => n + 1);
    },
  };
}

export function usePaywallOffer(): PaywallOffer | undefined {
  return usePaywallOfferState().offer;
}

/** L'essai gratuit est-il CONFIRMÉ pour ce compte (formule annuelle, celle
 * présélectionnée) ? Pour les libellés des verrous (<Locked>) : « Essayer
 * gratuitement » seulement si c'est vrai, sinon un libellé neutre. */
export function useTrialConfirmed(): boolean {
  const offer = usePaywallOffer();
  return offer?.ANNUAL?.trialEligible === true;
}
