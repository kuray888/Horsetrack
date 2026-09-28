import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
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
  const { redeemPromoCode, isActiveOrTrialing, status, billingPeriod, promotional } = useSubscription();
  // Abonnement store en cours (même règle que « Gérer » dans le Profil) : le
  // paywall montre la formule actuelle au lieu de proposer de s'abonner.
  const currentPeriod =
    isActiveOrTrialing && (status === "active" || billingPeriod !== null) ? billingPeriod : null;

  const horse = (params.horseId ? horses.find((h) => h.id === params.horseId) : null) ?? selectedHorse;
  const horseNames = horse?.name ? [horse.name] : [];

  async function onSubscribe(period: BillingPeriod) {
    await subscribe(
      period,
      (persisted) => {
        // Achat/essai confirmé : écran de bienvenue (activation + rappel de fin
        // d'essai) à la place du paywall, plutôt qu'un simple retour arrière.
        // Un abonné qui change de formule n'a pas à revoir la bienvenue.
        if (currentPeriod) router.back();
        else if (computeIsActiveOrTrialing(persisted)) router.replace("/premium-welcome");
        else router.back();
      },
      placement
    );
  }

  // Premium offert (ambassadeurs) : jamais d'offre d'achat, qui ferait payer
  // ce qui est déjà offert.
  if (promotional && isActiveOrTrialing) {
    return (
      <SafeAreaView className="flex-1 justify-center gap-5 bg-background px-6" edges={["top", "bottom"]}>
        <View className="gap-2">
          <Text className="text-2xl font-display tracking-tight text-text">Tu as déjà Premium</Text>
          <Text className="text-base text-muted">
            Ton accès Premium t&apos;est offert par Horsetrack : toutes les fonctionnalités sont débloquées, sans aucun paiement.
          </Text>
        </View>
        <PrimaryButton label="Fermer" onPress={() => router.back()} />
      </SafeAreaView>
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
      currentPeriod={currentPeriod}
    />
  );
}
