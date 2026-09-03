import { useEffect, useState } from "react";
import { Animated, View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import { colors } from "@/theme/colors";
import type { BillingPeriod } from "@/subscription/store";
import { isTrialEligible } from "@/lib/revenuecat";

const PERIODS: { id: BillingPeriod; label: string }[] = [
  { id: "ANNUAL", label: "Annuel" },
  { id: "MONTHLY", label: "Mensuel" },
];

// TODO(pivot tarifaire 2026-09-03) : le mensuel (3,99 €) vient de l'utilisateur ;
// l'annuel ci-dessous est un calcul provisoire (10 mois sur 12, cohérent avec
// le mensuel donné) — à confirmer/ajuster une fois le produit créé côté
// App Store Connect/RevenueCat (cf. plan Phase 4).
const PRICE: Record<BillingPeriod, string> = { MONTHLY: "3,99 €/mois", ANNUAL: "39,99 €/an" };
const PRICE_SUB: Record<BillingPeriod, string> = {
  MONTHLY: "sans engagement",
  // "2 mois offerts" évité ici : ambigu à côté du vrai essai de 2 mois
  // affiché juste en dessous (cf. trialEligible) — ce sous-titre ne parle
  // que de l'économie annuel vs mensuel, pas de l'essai.
  ANNUAL: "soit 3,33 €/mois · économise 16 % vs mensuel",
};

/** Un seul palier depuis le pivot tarifaire du 2026-09-03 : plus de
 * distinction Paddock/Grand Prix, l'abonnement débloque tout. */
const BULLETS: string[] = [
  "3 chevaux",
  "Planification manuelle illimitée",
  "Calendrier complet & rappels illimités",
  "Historique à vie",
  "Coffre-fort numérique",
  "Partage avec 1 demi-pension",
  "Concours multi-épreuves",
  "Suivi financier par cheval",
];

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <MaterialCommunityIcons name="check-circle" size={17} color={colors.success} />
      <Text className="flex-1 text-[15px] text-text">{text}</Text>
    </View>
  );
}

function PeriodToggle({ value, onChange }: { value: BillingPeriod; onChange: (p: BillingPeriod) => void }) {
  return (
    <View className="flex-row gap-2 self-center rounded-full bg-surface p-1">
      {PERIODS.map((p) => (
        <TouchableOpacity
          key={p.id}
          activeOpacity={0.85}
          onPress={() => onChange(p.id)}
          className={`rounded-full px-4 py-1.5 ${value === p.id ? "bg-primary" : ""}`}
        >
          <Text className={`text-sm font-semibold ${value === p.id ? "text-on-primary" : "text-muted"}`}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PlanCard({ period }: { period: BillingPeriod }) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className="gap-2.5 rounded-card border border-primary bg-highlight p-4"
      >
        <View>
          <Text className="text-xl font-extrabold text-primary">{PRICE[period]}</Text>
          <Text className="text-sm text-muted">{PRICE_SUB[period]}</Text>
        </View>
        <View className="gap-1.5 pt-1">
          {BULLETS.map((b) => (
            <Bullet key={b} text={b} />
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Vue du paywall, réutilisée par l'onboarding (hard gate, pas de `onClose` —
 * cf. (onboarding)/paywall.tsx) et le paywall accessible depuis l'app
 * (déclenché par <Locked>, `onClose` présent pour revenir en lecture seule).
 * Purement présentationnelle : la logique d'achat est injectée via
 * `onSubscribe`/`onPurchaseAddon`.
 */
export function PaywallView({
  onSubscribe,
  onClose,
  onRestore,
  onPurchaseAddon,
  submitting = false,
  restoring = false,
  title = "Débloque Horsetrack.",
}: {
  onSubscribe: (period: BillingPeriod) => void;
  onClose?: () => void;
  onRestore: () => void;
  onPurchaseAddon?: (period: BillingPeriod) => void;
  submitting?: boolean;
  restoring?: boolean;
  title?: string;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("ANNUAL");

  // Optimiste (true) tant que la vérification n'a pas répondu : le cas normal
  // (premier abonnement) reste éligible, donc pas de flash de copy "sans
  // essai" à chaque ouverture du paywall. Ne bascule à false que si le
  // check confirme qu'AUCUN essai ne sera accordé (offre non configurée côté
  // store, ou compte qui a déjà consommé son essai) — sans quoi le bouton
  // "Commencer mes 2 mois gratuits" mentirait juste avant qu'Apple facture
  // immédiatement (cf. mémoire projet "essai gratuit").
  const [trialEligible, setTrialEligible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Optimiste par défaut à chaque changement de période (cf. commentaire
    // ci-dessus) : un `false` confirmé pour ANNUAL ne doit pas rester collé
    // si le cavalier bascule ensuite sur MONTHLY, qui peut avoir sa propre
    // éligibilité.
    setTrialEligible(true);
    isTrialEligible(period).then((eligible: boolean | null) => {
      if (!cancelled && eligible === false) setTrialEligible(false);
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {onClose ? (
        <View className="flex-row justify-end px-5 pt-2">
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerClassName="px-5 pt-6 pb-4 gap-5" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-3xl font-extrabold leading-tight tracking-tight text-text">{title}</Text>
          <Text className="text-base text-muted">Annulable à tout moment depuis les réglages.</Text>
        </View>

        <PeriodToggle value={period} onChange={setPeriod} />

        <PlanCard period={period} />

        {onPurchaseAddon ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPurchaseAddon(period)}
            className="flex-row items-center gap-2 justify-between rounded-card border border-dashed border-primary p-4"
          >
            <View className="flex-1 flex-row items-center gap-2">
              <MaterialCommunityIcons name="plus-circle-outline" size={17} color={colors.primary} />
              <Text className="flex-1 text-sm font-semibold text-text">Ajouter un cheval supplémentaire</Text>
            </View>
            <Text className="text-sm font-bold text-primary">{period === "ANNUAL" ? "14,99 €/an" : "1,99 €/mois"}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={submitting ? "Un instant…" : trialEligible ? "Commencer mes 2 mois gratuits" : "S'abonner"}
          disabled={submitting}
          onPress={() => onSubscribe(period)}
        />
        <Text className="text-center text-xs leading-4 text-muted">
          {trialEligible ? `Essai gratuit de 2 mois, puis ${PRICE[period]}.` : `${PRICE[period]}.`} Renouvellement
          automatique, résiliable à tout moment dans les réglages.
        </Text>
        <View className="flex-row justify-center gap-5">
          <TouchableOpacity onPress={onRestore} disabled={restoring}>
            <Text className="text-xs font-semibold text-accent">
              {restoring ? "Restauration…" : "Restaurer mes achats"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/cgu`)}>
            <Text className="text-xs font-semibold text-accent">Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/confidentialite`)}>
            <Text className="text-xs font-semibold text-accent">Confidentialité</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
