import { router, useLocalSearchParams } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, useSubscription, computeIsActiveOrTrialing, type BillingPeriod } from "@/subscription/store";
import { parsePlacement } from "@/subscription/paywallLogic";
import { useHorses } from "@/horses/store";

/** Paywall plein écran de l'app, ouvert par openPaywall() (cf.
 * subscription/paywall.ts) avec son contexte dans `from` — et, quand il porte
 * sur un cheval précis (partage, budget), son `horseId` pour le citer. */
export default function AppPaywall() {
  const params = useLocalSearchParams<{ from?: string; horseId?: string }>();
  const placement = parsePlacement(params.from);
  const { horses, selectedHorse } = useHorses();
  const { submitting, subscribe, restoring, restore } = useSubscribeFlow();
  const { redeemPromoCode } = useSubscription();

  const horse = (params.horseId ? horses.find((h) => h.id === params.horseId) : null) ?? selectedHorse;
  const horseNames = horse?.name ? [horse.name] : [];

  async function onSubscribe(period: BillingPeriod) {
    await subscribe(
      period,
      (persisted) => {
        // Achat/essai confirmé : écran de bienvenue (activation + rappel de fin
        // d'essai) à la place du paywall, plutôt qu'un simple retour arrière.
        if (computeIsActiveOrTrialing(persisted)) router.replace("/premium-welcome");
        else router.back();
      },
      placement
    );
  }

  return (
    <PaywallView
      placement={placement}
      horseNames={horseNames}
      onSubscribe={onSubscribe}
      onClose={() => router.back()}
      onRestore={restore}
      onRedeemPromoCode={redeemPromoCode}
      submitting={submitting}
      restoring={restoring}
    />
  );
}
