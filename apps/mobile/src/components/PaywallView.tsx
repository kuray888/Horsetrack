import { useEffect, useRef, useState } from "react";
import { Animated, View, Text, TextInput, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { usePressScale } from "@/hooks/usePressScale";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { BillingPeriod } from "@/subscription/store";
import { usePaywallOffer } from "@/subscription/paywall";
import { track } from "@/lib/analytics";
import {
  BENEFITS,
  DEFAULT_TRIAL,
  FALLBACK_PRICE,
  annualSavingsPercent,
  formatDayMonth,
  formatFullDate,
  orderedBenefits,
  parseTrialPeriod,
  paywallCopy,
  trialDurationLabel,
  trialEndDate,
  trialReminderDate,
  type PaywallPlacement,
} from "@/subscription/paywallLogic";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** « an » / « mois », pour les phrases « 39,99 € par an ». */
const PERIOD_WORD: Record<BillingPeriod, string> = { MONTHLY: "mois", ANNUAL: "an" };

const CANCEL_WHERE = Platform.OS === "ios" ? "Réglages > Abonnements" : "Google Play > Abonnements";

/** Palier gratuit — cf. rls.sql, tout ce qui n'appelle pas
 * rider_is_active_or_trialing. */
const FREE_BULLETS: string[] = ["1 cheval", "Planning & agenda", "Journal d'entraînement", "Dépenses de base", "Objectifs"];

/** Palier Premium — n'inclut QUE ce qui n'est pas déjà dans le palier
 * gratuit ci-dessus. */
const PREMIUM_BULLETS: string[] = [
  "Chevaux illimités",
  "Rappels automatiques",
  "Coffre-fort numérique",
  "Partage (demi-pension, coach, cavalière, groom)",
  "Concours multi-épreuves",
  "Budget détaillé",
];

/** Comparatif gratuit/Premium — replié par défaut sous les bénéfices : il
 * répond à « qu'est-ce que je garde gratuitement ? » pour qui le cherche, sans
 * que la colonne gratuite ne concurrence visuellement l'offre à l'ouverture. */
function ComparisonCard() {
  const colors = useThemeColors();
  return (
    <View className="flex-row overflow-hidden rounded-card border border-border">
      <View className="flex-1 gap-2.5 bg-surface p-4">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-muted">Gratuit</Text>
        {FREE_BULLETS.map((b) => (
          <View key={b} className="flex-row items-start gap-1.5">
            <MaterialCommunityIcons name="check" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-[13px] leading-4 text-text">{b}</Text>
          </View>
        ))}
      </View>
      <View className="flex-1 gap-2.5 border-l border-primary/20 bg-highlight p-4">
        <View className="flex-row items-center gap-1">
          <MaterialCommunityIcons name="star" size={12} color={colors.primary} />
          <Text className="text-[11px] font-bold uppercase tracking-wide text-primary">Premium, en plus</Text>
        </View>
        {PREMIUM_BULLETS.map((b) => (
          <View key={b} className="flex-row items-start gap-1.5">
            <MaterialCommunityIcons name="check" size={14} color={colors.primary} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-[13px] leading-4 font-medium text-text">{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Code promo — replié par défaut. La validité/durée sont décidées uniquement
 * côté serveur (`onRedeem`, cf. subscription/store.tsx redeemPromoCode) — ce
 * composant ne fait qu'afficher le résultat renvoyé. */
function PromoCodeField({ onRedeem }: { onRedeem: (code: string) => Promise<{ ok: boolean; message: string }> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function apply() {
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    const result = await onRedeem(code.trim());
    setFeedback(result);
    setSubmitting(false);
  }

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7} className="items-center py-1">
        <Text className="text-sm font-semibold text-accent">Tu as un code promo ?</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <TextInput
          className="flex-1 rounded-card border border-border bg-surface p-3 text-base text-text"
          placeholder="Code promo"
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setFeedback(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={apply}
          disabled={!code.trim() || submitting}
          activeOpacity={0.85}
          className={`items-center justify-center rounded-card px-4 ${
            code.trim() && !submitting ? "bg-primary" : "border border-border"
          }`}
        >
          <Text className={`text-sm font-bold ${code.trim() && !submitting ? "text-on-primary" : "text-muted"}`}>
            {submitting ? "…" : "Appliquer"}
          </Text>
        </TouchableOpacity>
      </View>
      {feedback ? (
        <Text className={`text-xs ${feedback.ok ? "text-success" : "text-danger"}`}>{feedback.message}</Text>
      ) : null}
    </View>
  );
}

/** Carte de formule sélectionnable. Le montant FACTURÉ est l'élément de prix
 * le plus visible ; l'équivalent mensuel reste subordonné (règle App Store
 * 3.1.2). Les deux cartes ont la même taille : le mensuel n'est pas caché. */
function PlanCard({
  label,
  price,
  sub,
  badge,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  sub: string | null;
  badge: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}, ${price}${sub ? `, ${sub}` : ""}`}
        className={`flex-row items-center gap-3 rounded-card border-2 p-4 ${
          selected ? "border-primary bg-highlight" : "border-border bg-surface"
        }`}
      >
        <MaterialCommunityIcons
          name={selected ? "radiobox-marked" : "radiobox-blank"}
          size={22}
          color={selected ? colors.primary : colors.textMuted}
        />
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-base font-bold text-text">{label}</Text>
            {badge ? (
              <View className="rounded-full bg-primary px-2 py-0.5">
                <Text className="text-[11px] font-bold text-on-primary">{badge}</Text>
              </View>
            ) : null}
          </View>
          {sub ? <Text className="text-xs text-muted">{sub}</Text> : null}
        </View>
        <Text className="text-lg font-display-bold text-text">{price}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Frise de l'essai (cf. « paywall honnête » Blinkist) : ce qui se passe
 * aujourd'hui, quand on prévient, quand le paiement commence. Affichée
 * uniquement quand l'essai est CONFIRMÉ par le store. Le rappel annoncé est
 * réellement programmé après l'achat (cf. subscription/trialLifecycle.ts). */
function TrialTimeline({ reminderAt, endAt, priceLine }: { reminderAt: Date | null; endAt: Date; priceLine: string }) {
  const colors = useThemeColors();
  const steps: { icon: IconName; when: string; what: string }[] = [
    { icon: "lock-open-variant-outline", when: "Aujourd'hui", what: "Tout Premium est débloqué." },
    ...(reminderAt
      ? [{ icon: "bell-outline" as IconName, when: formatDayMonth(reminderAt), what: "On te prévient que l'essai se termine bientôt." }]
      : []),
    {
      icon: "star-outline",
      when: formatDayMonth(endAt),
      what: `Début de l'abonnement, ${priceLine}. Annule avant cette date, tu ne paies rien.`,
    },
  ];
  return (
    <View className="gap-0 rounded-card bg-surface p-4">
      {steps.map((s, i) => (
        <View key={s.when} className="flex-row gap-3">
          <View className="items-center">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-highlight">
              <MaterialCommunityIcons name={s.icon} size={16} color={colors.primary} />
            </View>
            {i < steps.length - 1 ? <View className="w-0.5 flex-1 bg-primary/25" style={{ minHeight: 14 }} /> : null}
          </View>
          <View className={`flex-1 gap-0.5 ${i < steps.length - 1 ? "pb-3" : ""}`}>
            <Text className="text-sm font-bold text-text">{s.when}</Text>
            <Text className="text-sm text-muted">{s.what}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Vue du paywall, réutilisée par l'onboarding (`onSkip` présent, pas
 * `onClose` — cf. (onboarding)/paywall.tsx) et le paywall de l'app (ouvert par
 * openPaywall(), `onClose` présent). Le texte s'adapte au contexte
 * (`placement`) ; prix et essai viennent du store (cf. usePaywallOffer).
 * Purement présentationnelle : la logique d'achat est injectée via
 * `onSubscribe`.
 */
export function PaywallView({
  placement,
  horseNames = [],
  onSubscribe,
  onClose,
  onSkip,
  skipLabel = "Continuer avec la version gratuite",
  onRestore,
  onRedeemPromoCode,
  submitting = false,
  restoring = false,
}: {
  placement: PaywallPlacement;
  /** Chevaux à citer dans le titre (brouillon d'onboarding, cheval concerné). */
  horseNames?: string[];
  onSubscribe: (period: BillingPeriod) => void;
  onClose?: () => void;
  /** Sortie vers le palier gratuit — uniquement pour le paywall d'onboarding,
   * qui n'a pas de bouton de fermeture. */
  onSkip?: () => void;
  skipLabel?: string;
  onRestore: () => void;
  /** Absent pendant l'onboarding : le rider_profile n'existe pas encore côté
   * serveur à ce stade, un code y échouerait toujours. */
  onRedeemPromoCode?: (code: string) => Promise<{ ok: boolean; message: string }>;
  submitting?: boolean;
  restoring?: boolean;
}) {
  const colors = useThemeColors();
  const [period, setPeriod] = useState<BillingPeriod>("ANNUAL");
  const [compareOpen, setCompareOpen] = useState(false);
  const offer = usePaywallOffer();
  // Instant d'ouverture, pour la durée passée sur le paywall (analytics) —
  // posé au montage plutôt qu'au rendu (règle de pureté des composants).
  const openedAt = useRef(0);
  const viewTracked = useRef(false);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const copy = paywallCopy(placement, horseNames);
  const benefits = orderedBenefits(placement);

  const plan = (p: BillingPeriod) => ({
    price: offer?.[p]?.price ?? FALLBACK_PRICE[p].price,
    priceString: offer?.[p]?.priceString ?? FALLBACK_PRICE[p].priceString,
    pricePerMonthString: offer?.[p]?.pricePerMonthString ?? null,
  });
  const monthly = plan("MONTHLY");
  const annual = plan("ANNUAL");
  const savings = annualSavingsPercent(monthly.price, annual.price);
  const selected = period === "ANNUAL" ? annual : monthly;
  const selectedInfo = offer?.[period];

  const loading = offer === undefined;
  // Seul un `true` confirmé par le store autorise la promesse d'essai.
  const trialConfirmed = selectedInfo?.trialEligible === true;
  const trial = parseTrialPeriod(selectedInfo?.trialUnit, selectedInfo?.trialCount) ?? DEFAULT_TRIAL;
  const now = new Date();
  const trialEnd = trialEndDate(now, trial);
  const reminderAt = trialReminderDate(trialEnd, now);
  const priceLine = `${selected.priceString} par ${PERIOD_WORD[period]}`;

  useEffect(() => {
    if (loading || viewTracked.current) return;
    viewTracked.current = true;
    track("paywall_viewed", {
      placement,
      horse_names_shown: horseNames.length,
      trial_eligible: offer?.ANNUAL?.trialEligible ?? null,
      store_prices: !!offer?.ANNUAL,
    });
  }, [loading, offer, placement, horseNames.length]);

  function selectPeriod(p: BillingPeriod) {
    setPeriod(p);
    track("paywall_plan_selected", { placement, period: p });
  }

  function close() {
    track("paywall_dismissed", { placement, seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000) });
    onClose?.();
  }

  function skip() {
    track("free_tier_chosen", { placement, seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000) });
    onSkip?.();
  }

  const ctaLabel = submitting
    ? "Un instant…"
    : loading
      ? "Chargement de l'offre…"
      : trialConfirmed
        ? `Essayer gratuitement pendant ${trialDurationLabel(trial)}`
        : `S'abonner · ${selected.priceString}/${PERIOD_WORD[period]}`;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {onClose ? (
        <View className="flex-row justify-end px-5 pt-2">
          <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-4 gap-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInView>
          <View className="gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-highlight">
              <MaterialCommunityIcons name={copy.icon as IconName} size={28} color={colors.primary} />
            </View>
            <Text className="text-3xl font-display leading-tight tracking-tight text-text">{copy.title}</Text>
            <Text className="text-base text-muted">{copy.subtitle}</Text>
          </View>
        </FadeInView>

        <View className="gap-3">
          {benefits.map((id, i) => (
            <FadeInView key={id} delay={80 + i * 60}>
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-highlight">
                  <MaterialCommunityIcons name={BENEFITS[id].icon as IconName} size={17} color={colors.primary} />
                </View>
                <Text className="flex-1 text-[15px] leading-5 text-text">{BENEFITS[id].text}</Text>
              </View>
            </FadeInView>
          ))}
          <TouchableOpacity
            onPress={() => {
              if (!compareOpen) track("paywall_compare_opened", { placement });
              setCompareOpen((v) => !v);
            }}
            activeOpacity={0.7}
            className="flex-row items-center gap-1 self-start py-1"
          >
            <Text className="text-sm font-semibold text-accent">Comparer gratuit et Premium</Text>
            <MaterialCommunityIcons name={compareOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} />
          </TouchableOpacity>
          {compareOpen ? <ComparisonCard /> : null}
        </View>

        <View className="gap-2.5" accessibilityRole="radiogroup">
          <PlanCard
            label="Annuel"
            price={`${annual.priceString}/an`}
            sub={annual.pricePerMonthString ? `soit ${annual.pricePerMonthString}/mois` : null}
            badge={savings ? `Le plus avantageux · −${savings} %` : "Le plus avantageux"}
            selected={period === "ANNUAL"}
            onPress={() => selectPeriod("ANNUAL")}
          />
          <PlanCard
            label="Mensuel"
            price={`${monthly.priceString}/mois`}
            sub="sans engagement"
            badge={null}
            selected={period === "MONTHLY"}
            onPress={() => selectPeriod("MONTHLY")}
          />
        </View>

        {trialConfirmed ? <TrialTimeline reminderAt={reminderAt} endAt={trialEnd} priceLine={priceLine} /> : null}

        {onRedeemPromoCode ? <PromoCodeField onRedeem={onRedeemPromoCode} /> : null}
      </ScrollView>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={ctaLabel}
          disabled={submitting || loading}
          onPress={() => {
            track("paywall_cta_tapped", { placement, period, trial: trialConfirmed });
            onSubscribe(period);
          }}
        />
        <Text className="text-center text-xs leading-4 text-muted">
          {trialConfirmed
            ? `Gratuit jusqu'au ${formatFullDate(trialEnd)}, puis ${priceLine}, renouvelé automatiquement.`
            : `${priceLine}, renouvelé automatiquement.`}{" "}
          Annulable à tout moment dans {CANCEL_WHERE}.
        </Text>
        {onSkip ? (
          // Lien texte contrasté (text-text) : le palier gratuit permanent doit
          // rester visible à côté du CTA, sans rivaliser avec lui (cf. retour
          // produit du 2026-09-12).
          <TouchableOpacity onPress={skip} disabled={submitting} hitSlop={8} className="py-1">
            <Text className="text-center text-sm font-semibold text-text underline">{skipLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <View className="flex-row justify-center gap-5">
          <TouchableOpacity onPress={onRestore} disabled={restoring}>
            <Text className="text-xs font-semibold text-accent">
              {restoring ? "Restauration…" : "Restaurer mes achats"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/cgu`).catch(() => {})}>
            <Text className="text-xs font-semibold text-accent">Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/confidentialite`).catch(() => {})}>
            <Text className="text-xs font-semibold text-accent">Confidentialité</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
