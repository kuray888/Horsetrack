import { useEffect, useState } from "react";
import { Animated, View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import type { BillingPeriod } from "@/subscription/store";
import { isGrandPrixTrialEligible, type PaidTier } from "@/lib/revenuecat";

const PERIODS: { id: BillingPeriod; label: string }[] = [
  { id: "ANNUAL", label: "Annuel" },
  { id: "MONTHLY", label: "Mensuel" },
];

const TIERS: {
  id: PaidTier;
  title: string;
  price: Record<BillingPeriod, string>;
  sub: Record<BillingPeriod, string>;
  badge?: string;
  bullets: string[];
}[] = [
  {
    id: "PADDOCK",
    title: "Paddock",
    price: { MONTHLY: "4,99 €/mois", ANNUAL: "39,99 €/an" },
    sub: { MONTHLY: "sans engagement", ANNUAL: "soit 3,33 €/mois · économise 33 %" },
    bullets: [
      "2 chevaux",
      "Calendrier complet & rappels illimités",
      "Historique à vie",
      "Coffre-fort numérique",
      "Partage avec 1 demi-pension",
    ],
  },
  {
    id: "GRAND_PRIX",
    title: "Grand Prix",
    price: { MONTHLY: "19,99 €/mois", ANNUAL: "169,99 €/an" },
    sub: { MONTHLY: "sans engagement", ANNUAL: "soit 14,17 €/mois · économise 29 %" },
    badge: "Le plus complet",
    // TODO(pivot sans IA) : différenciateur "Coach IA + programme" retiré
    // avec la génération de programme par IA. Bullets à compléter une fois
    // le suivi financier construit (cf. plan de pivot, palier Grand Prix
    // redéfini autour de ça).
    bullets: ["3 chevaux", "Tout Paddock"],
  },
];

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Text className="text-base text-success">✓</Text>
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

function TierCard({
  tier,
  period,
  active,
  onPress,
}: {
  tier: (typeof TIERS)[number];
  period: BillingPeriod;
  active: boolean;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`gap-2.5 rounded-card border p-4 ${active ? "border-primary bg-highlight" : "border-border bg-surface"}`}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-text">{tier.title}</Text>
          {tier.badge ? (
            <View className="rounded-full bg-primary px-2.5 py-1">
              <Text className="text-xs font-bold text-on-primary">{tier.badge}</Text>
            </View>
          ) : null}
        </View>
        <View>
          <Text className="text-xl font-extrabold text-primary">{tier.price[period]}</Text>
          <Text className="text-sm text-muted">{tier.sub[period]}</Text>
        </View>
        <View className="gap-1.5 pt-1">
          {tier.bullets.map((b) => (
            <Bullet key={b} text={b} />
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Vue du paywall, réutilisée par l'onboarding et le paywall accessible depuis l'app
 * (déclenché par <Locked>). Purement présentationnelle : la logique d'achat est
 * injectée via `onSubscribe`/`onPurchaseAddon`. `onClose` optionnel = paywall
 * skippable (mode gaté, reste sur Free). `onPurchaseAddon` optionnel = la ligne
 * add-on n'a de sens qu'une fois déjà abonné (paywall in-app), pas à l'onboarding.
 */
export function PaywallView({
  onSubscribe,
  onClose,
  onRestore,
  onPurchaseAddon,
  submitting = false,
  restoring = false,
  title = "Choisis ton accès.",
  initialTier = "GRAND_PRIX",
}: {
  onSubscribe: (tier: PaidTier, period: BillingPeriod) => void;
  onClose?: () => void;
  onRestore: () => void;
  onPurchaseAddon?: (period: BillingPeriod) => void;
  submitting?: boolean;
  restoring?: boolean;
  title?: string;
  /** Palier présélectionné à l'ouverture (ex: Paddock si le cavalier a déjà 2 chevaux à l'onboarding). */
  initialTier?: PaidTier;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("ANNUAL");
  const [selected, setSelected] = useState<PaidTier>(initialTier);
  // Non-null : `selected` ne prend que des valeurs présentes dans TIERS.
  const selectedTier = TIERS.find((t) => t.id === selected)!;

  // Optimiste (true) tant que la vérification n'a pas répondu : le cas normal
  // (premier abonnement) reste éligible, donc pas de flash de copy "sans
  // essai" à chaque ouverture du paywall. Ne bascule à false que si le
  // check confirme qu'AUCUN essai ne sera accordé (offre non configurée côté
  // store, ou compte qui a déjà consommé son essai Grand Prix) — sans quoi
  // le bouton "Commencer mes 7 jours gratuits" mentirait juste avant qu'Apple
  // facture immédiatement (cf. mémoire projet "essai gratuit Grand Prix").
  const [grandPrixTrialEligible, setGrandPrixTrialEligible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Optimiste par défaut à chaque changement de période (cf. commentaire
    // ci-dessus) : un `false` confirmé pour ANNUAL ne doit pas rester collé
    // si le cavalier bascule ensuite sur MONTHLY, qui peut avoir sa propre
    // éligibilité.
    setGrandPrixTrialEligible(true);
    isGrandPrixTrialEligible(period).then((eligible) => {
      if (!cancelled && eligible === false) setGrandPrixTrialEligible(false);
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const showTrialCopy = selected === "GRAND_PRIX" && grandPrixTrialEligible;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {onClose ? (
        <View className="flex-row justify-end px-5 pt-2">
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text className="text-xl text-muted">✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerClassName="px-5 pt-6 pb-4 gap-5" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-3xl font-extrabold leading-tight tracking-tight text-text">{title}</Text>
          <Text className="text-base text-muted">Annulable à tout moment depuis les réglages.</Text>
        </View>

        <PeriodToggle value={period} onChange={setPeriod} />

        <View className="gap-3">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              period={period}
              active={selected === tier.id}
              onPress={() => setSelected(tier.id)}
            />
          ))}
        </View>

        {onPurchaseAddon ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPurchaseAddon(period)}
            className="flex-row items-center justify-between rounded-card border border-dashed border-primary p-4"
          >
            <Text className="flex-1 text-sm font-semibold text-text">➕ Ajouter un cheval supplémentaire</Text>
            <Text className="text-sm font-bold text-primary">{period === "ANNUAL" ? "14,99 €/an" : "1,99 €/mois"}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={
            submitting
              ? "Un instant…"
              : showTrialCopy
                ? "Commencer mes 7 jours gratuits"
                : `Choisir ${selectedTier.title}`
          }
          disabled={submitting}
          onPress={() => onSubscribe(selected, period)}
        />
        <Text className="text-center text-xs leading-4 text-muted">
          {showTrialCopy
            ? `Essai gratuit de 7 jours, puis ${selectedTier.price[period]}.`
            : `${selectedTier.price[period]}.`}{" "}
          Renouvellement automatique, résiliable à tout moment dans les réglages.
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
