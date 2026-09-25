import { useEffect, useState } from "react";
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
  MONTHLY: { price: 3.99, priceString: "3,99 €", pricePerMonthString: "3,99 €", trialEligible: true, trialUnit: "MONTH", trialCount: 1 },
  ANNUAL: { price: 39.99, priceString: "39,99 €", pricePerMonthString: "3,33 €", trialEligible: true, trialUnit: "MONTH", trialCount: 1 },
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
 * définitif ni promesse d'essai), puis l'offre — éventuellement vide. */
export function usePaywallOffer(): PaywallOffer | undefined {
  const [offer, setOffer] = useState<PaywallOffer | undefined>(undefined);
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
  }, []);
  return offer;
}

/** L'essai gratuit est-il CONFIRMÉ pour ce compte (formule annuelle, celle
 * présélectionnée) ? Pour les libellés des verrous (<Locked>) : « Essayer
 * gratuitement » seulement si c'est vrai, sinon un libellé neutre. */
export function useTrialConfirmed(): boolean {
  const offer = usePaywallOffer();
  return offer?.ANNUAL?.trialEligible === true;
}
