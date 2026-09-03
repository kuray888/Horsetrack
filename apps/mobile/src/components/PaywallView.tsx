import { useEffect, useState } from "react";
import { Animated, View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { BillingPeriod } from "@/subscription/store";
import { isTrialEligible } from "@/lib/revenuecat";

const PERIODS: { id: BillingPeriod; label: string }[] = [
  { id: "ANNUAL", label: "Annuel" },
  { id: "MONTHLY", label: "Mensuel" },
];

// Pivot freemium du 2026-09-03 (v2) : prix confirmés par le produit —
// à recréer côté App Store Connect/RevenueCat avec ces montants exacts
// (cf. plan Phase 4).
const PRICE: Record<BillingPeriod, string> = { MONTHLY: "3,99 €/mois", ANNUAL: "34,99 €/an" };
const PRICE_SUB: Record<BillingPeriod, string> = {
  MONTHLY: "sans engagement",
  // "2 mois offerts" évité ici : ambigu à côté du vrai essai affiché juste
  // en dessous (cf. trialEligible) — ce sous-titre ne parle que de
  // l'économie annuel vs mensuel, pas de l'essai.
  ANNUAL: "soit 2,92 €/mois · économise 27 % vs mensuel",
};

/** Palier Premium depuis le pivot freemium du 2026-09-03 (v2) — n'inclut QUE
 * ce qui n'est pas déjà dans le palier gratuit (planning, agenda, journal,
 * dépenses de base et objectifs sont gratuits, cf. rls.sql). */
const BULLETS: string[] = [
  "3 chevaux (au lieu d'1)",
  "Partage avec 1 collaborateur·rice (demi-pension, coach, cavalière, groom)",
  "Coffre-fort numérique",
  "Concours multi-épreuves",
  "Rappels automatiques (push + email)",
];

function Bullet({ text }: { text: string }) {
  const colors = useThemeColors();
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
 * Vue du paywall, réutilisée par l'onboarding (`onSkip` présent, pas
 * `onClose` — cf. (onboarding)/paywall.tsx) et le paywall accessible depuis
 * l'app (déclenché par <Locked>, `onClose` présent pour revenir à l'écran
 * précédent). Purement présentationnelle : la logique d'achat est injectée
 * via `onSubscribe`/`onPurchaseAddon`.
 */
export function PaywallView({
  onSubscribe,
  onClose,
  onSkip,
  onRestore,
  onPurchaseAddon,
  submitting = false,
  restoring = false,
  title = "Passe à Horsetrack Premium.",
}: {
  onSubscribe: (period: BillingPeriod) => void;
  onClose?: () => void;
  /** Affiche un lien "Continuer avec le palier gratuit" — utilisé uniquement
   * par le paywall d'onboarding (cf. (onboarding)/paywall.tsx), qui n'a pas
   * de bouton de fermeture puisqu'il n'y a rien à "fermer" à ce stade. */
  onSkip?: () => void;
  onRestore: () => void;
  onPurchaseAddon?: (period: BillingPeriod) => void;
  submitting?: boolean;
  restoring?: boolean;
  title?: string;
}) {
  const colors = useThemeColors();
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
          label={submitting ? "Un instant…" : trialEligible ? "Commencer mon mois gratuit" : "S'abonner"}
          disabled={submitting}
          onPress={() => onSubscribe(period)}
        />
        <Text className="text-center text-xs leading-4 text-muted">
          {trialEligible ? `Essai gratuit d'1 mois, puis ${PRICE[period]}.` : `${PRICE[period]}.`} Renouvellement
          automatique, résiliable à tout moment dans les réglages.
        </Text>
        {onSkip ? (
          <TouchableOpacity onPress={onSkip} disabled={submitting} hitSlop={8}>
            <Text className="text-center text-sm font-semibold text-muted">Continuer avec le palier gratuit</Text>
          </TouchableOpacity>
        ) : null}
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
