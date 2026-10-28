import { useEffect, useRef, useState } from "react";
import { Animated, View, Text, TextInput, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { Skeleton } from "@/components/Skeleton";
import { usePressScale } from "@/hooks/usePressScale";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { BillingPeriod, PromoRedeemResult } from "@/subscription/store";
import { usePaywallOfferState } from "@/subscription/paywall";
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
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { getPromoContext, promoAnalyticsProps } from "@/subscription/promoContext";
import { t } from "@/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** « an » / « mois », pour les phrases « 39,99 € par an ». */
const PERIOD_WORD: Record<BillingPeriod, string> = { MONTHLY: "mois", ANNUAL: "an" };

const CANCEL_WHERE = Platform.OS === "ios" ? t("Réglages > Abonnements") : t("Google Play > Abonnements");

/** Palier gratuit — cf. rls.sql, tout ce qui n'appelle pas
 * rider_is_active_or_trialing. */
const FREE_BULLETS: string[] = [
  t("1 cheval"),
  t("Planning & agenda"),
  t("1 rappel à la fois"),
  t("Journal d'entraînement"),
  t("Séances en direct (chrono, GPS, allures)"),
  t("Dépenses de base"),
  t("Objectifs"),
];

/** Palier Premium — n'inclut QUE ce qui n'est pas déjà dans le palier
 * gratuit ci-dessus. */
const PREMIUM_BULLETS: string[] = [
  t("Chevaux illimités"),
  t("Rappels illimités (notification et e-mail)"),
  t("Coffre-fort numérique"),
  t("Partage de chaque cheval avec une personne (demi-pension, coach ou groom)"),
  t("Concours multi-épreuves"),
  t("Budget détaillé"),
  t("Sécurité en balade : position partagée, alerte si tu ne bouges plus"),
  t("Coach : séance du jour expliquée, questions sur ton cheval, résumé du mois"),
];

/** Comparatif gratuit/Premium — replié par défaut sous les bénéfices : il
 * répond à « qu'est-ce que je garde gratuitement ? » pour qui le cherche, sans
 * que la colonne gratuite ne concurrence visuellement l'offre à l'ouverture. */
function ComparisonCard() {
  const colors = useThemeColors();
  return (
    <View className="flex-row overflow-hidden rounded-card border border-border">
      <View className="flex-1 gap-2.5 bg-surface p-4">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-muted">{t("Gratuit")}</Text>
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
          <Text className="text-[11px] font-bold uppercase tracking-wide text-primary">{t("Premium, en plus")}</Text>
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

/** Code promo — replié par défaut. La validité et l'effet sont décidés
 * uniquement côté serveur (`onRedeem`, cf. subscription/store.tsx
 * redeemPromoCode) — ce composant ne fait qu'afficher le résultat renvoyé.
 * Remise sur l'abonnement : ouvre la feuille officielle de l'App Store, qui
 * affiche le prix remisé et facture — jamais un prix calculé ici. */
function PromoCodeField({
  onRedeem,
  onStoreOfferOpened,
}: {
  onRedeem: (code: string) => Promise<PromoRedeemResult>;
  onStoreOfferOpened?: () => void;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PromoRedeemResult | null>(null);
  const canSubmit = code.trim().length > 0 && !submitting;

  function openStore(url: string, source: "server_offer" | "unknown_code") {
    track("promo_store_redeem_opened", { source });
    onStoreOfferOpened?.();
    Linking.openURL(url).catch(() =>
      setFeedback({ ok: false, message: t("Impossible d'ouvrir l'App Store. Réessaie dans un instant.") })
    );
  }

  async function apply() {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    const result = await onRedeem(code.trim());
    if (result.ok) hapticSuccess();
    else hapticError();
    animateNextLayout();
    setFeedback(result);
    setSubmitting(false);
    if (result.ok && result.redeemUrl) openStore(result.redeemUrl, "server_offer");
  }

  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => {
          animateNextLayout();
          setOpen(true);
        }}
        activeOpacity={0.7}
        className="items-center py-1"
        accessibilityRole="button"
        testID="paywall-promo-open"
      >
        <Text className="text-sm font-semibold text-accent">{t("Tu as un code promo ?")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <FadeInView>
      <View className="gap-2">
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 rounded-card border border-border bg-surface p-3 text-base text-text"
            placeholder={t("Code promo")}
            placeholderTextColor={colors.textMuted}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setFeedback(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={apply}
            accessibilityLabel={t("Code promo")}
            testID="paywall-promo-input"
          />
          <TouchableOpacity
            onPress={apply}
            disabled={!canSubmit}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="paywall-promo-apply"
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            className={`min-w-[96px] items-center justify-center rounded-card px-4 ${
              canSubmit ? "bg-primary" : "border border-border"
            }`}
          >
            <Text className={`text-sm font-bold ${canSubmit ? "text-on-primary" : "text-muted"}`}>
              {submitting ? t("Vérification…") : t("Appliquer")}
            </Text>
          </TouchableOpacity>
        </View>
        {feedback ? (
          <View className="flex-row items-start gap-1.5" accessibilityLiveRegion="polite">
            <MaterialCommunityIcons
              name={feedback.ok ? "check-circle" : "alert-circle-outline"}
              size={16}
              color={feedback.ok ? colors.success : colors.danger}
              style={{ marginTop: 1 }}
            />
            <Text
              className={`flex-1 text-xs leading-4 ${feedback.ok ? "text-success" : "text-danger"}`}
              testID={feedback.ok ? "paywall-promo-ok" : "paywall-promo-error"}
            >
              {feedback.message}
            </Text>
          </View>
        ) : null}
        {feedback?.ok && feedback.redeemUrl ? (
          <TouchableOpacity onPress={() => openStore(feedback.redeemUrl!, "server_offer")} hitSlop={8} className="self-start">
            <Text className="text-sm font-semibold text-accent">{t("Rouvrir l'offre sur l'App Store")}</Text>
          </TouchableOpacity>
        ) : null}
        {!feedback?.ok && feedback?.storeFallbackUrl ? (
          <TouchableOpacity
            onPress={() => openStore(feedback.storeFallbackUrl!, "unknown_code")}
            hitSlop={8}
            className="self-start"
          >
            <Text className="text-sm font-semibold text-accent">{t("C'est un code App Store ? L'utiliser sur l'App Store")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </FadeInView>
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
  testID,
}: {
  testID?: string;
  label: string;
  /** null pendant le chargement de l'offre : emplacement animé plutôt qu'un
   * prix provisoire qui pourrait différer du prix facturé. */
  price: string | null;
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
        testID={testID}
        accessibilityLabel={`${label}, ${price ?? t("prix en cours de chargement")}${sub ? `, ${sub}` : ""}`}
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
        {price === null ? (
          <Skeleton width={84} height={20} />
        ) : (
          <Text className="text-lg font-display-bold text-text">{price}</Text>
        )}
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
    { icon: "lock-open-variant-outline", when: "Aujourd'hui", what: t("Tout Premium est débloqué.") },
    ...(reminderAt
      ? [{ icon: "bell-outline" as IconName, when: formatDayMonth(reminderAt), what: t("On te prévient que l'essai se termine bientôt.") }]
      : []),
    {
      icon: "star-outline",
      when: formatDayMonth(endAt),
      what: t("Début de l'abonnement, {priceLine}. Annule avant cette date, tu ne paies rien.", { priceLine: priceLine }),
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
  skipLabel = t("Continuer avec la version gratuite"),
  onRestore,
  onRedeemPromoCode,
  onStoreOfferOpened,
  submitting = false,
  restoring = false,
  currentPeriod = null,
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
  onRedeemPromoCode?: (code: string) => Promise<PromoRedeemResult>;
  /** La feuille de rédemption du store vient d'être ouverte (remise sur
   * l'abonnement) : l'écran parent guette l'activation au retour. */
  onStoreOfferOpened?: () => void;
  submitting?: boolean;
  restoring?: boolean;
  /** Formule de l'abonnement store en cours, pour un abonné qui ouvre le
   * paywall depuis « Gérer » (Profil) : on lui montre sa formule plutôt que
   * de lui proposer de s'abonner à ce qu'il a déjà. */
  currentPeriod?: BillingPeriod | null;
}) {
  const colors = useThemeColors();
  // Abonné : l'autre formule d'abord (le passage à l'annuel, le plus souvent).
  const [period, setPeriod] = useState<BillingPeriod>(currentPeriod === "ANNUAL" ? "MONTHLY" : "ANNUAL");
  const [compareOpen, setCompareOpen] = useState(false);
  const { offer, retry: retryOffer } = usePaywallOfferState();
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
  const savings = offer?.MONTHLY && offer?.ANNUAL ? annualSavingsPercent(monthly.price, annual.price) : null;
  const selected = period === "ANNUAL" ? annual : monthly;
  const selectedInfo = offer?.[period];

  const loading = offer === undefined;
  // Prix du store absents (réseau, store muet) : on n'affiche AUCUN prix de
  // repli. Un montant écrit en dur (39,99 €) pouvait différer de celui que la
  // fiche d'achat facture ensuite (autre pays, autre devise) — le prix montré
  // doit toujours être celui du store (cf. storePriceString).
  const storeUnavailable = !loading && !(offer?.MONTHLY && offer?.ANNUAL);
  const isCurrent = currentPeriod !== null && period === currentPeriod;
  // Seul un `true` confirmé par le store autorise la promesse d'essai (jamais
  // pour un abonné, qui a déjà eu le sien).
  const trialConfirmed = !currentPeriod && selectedInfo?.trialEligible === true;
  const trial = parseTrialPeriod(selectedInfo?.trialUnit, selectedInfo?.trialCount) ?? DEFAULT_TRIAL;
  const now = new Date();
  const trialEnd = trialEndDate(now, trial);
  const reminderAt = trialReminderDate(trialEnd, now);
  const priceLine = t("{priceString} par {v}", { priceString: selected.priceString, v: PERIOD_WORD[period] });

  useEffect(() => {
    if (loading || viewTracked.current) return;
    viewTracked.current = true;
    track("paywall_viewed", {
      placement,
      horse_names_shown: horseNames.length,
      trial_eligible: offer?.ANNUAL?.trialEligible ?? null,
      // Essai configuré dans le store (false : aucune offre d'essai sur le
      // produit annuel — à corriger dans App Store Connect).
      trial_offer_annual: offer?.ANNUAL?.hasFreeTrialOffer ?? null,
      trial_offer_monthly: offer?.MONTHLY?.hasFreeTrialOffer ?? null,
      store_prices: !!offer?.ANNUAL,
      // Diagnostic de la devise renvoyée par le store (cf. formatStorePrice).
      currency: offer?.ANNUAL?.currencyCode ?? null,
      storefront: offer?.ANNUAL?.storefrontCountry ?? null,
      // Code promo saisi ou offre de retour vue avant ce paywall (cf.
      // subscription/promoContext.ts), et champ code promo proposé ici.
      promo_field: !!onRedeemPromoCode && !currentPeriod,
      ...promoAnalyticsProps(getPromoContext()),
    });
  }, [loading, offer, placement, horseNames.length, onRedeemPromoCode, currentPeriod]);

  function selectPeriod(p: BillingPeriod) {
    if (p !== period) hapticSelection();
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
    ? t("Un instant…")
    : loading
      ? t("Chargement de l'offre…")
      : storeUnavailable
        ? t("Offre indisponible pour le moment")
        : isCurrent
        ? t("C'est ta formule actuelle")
        : currentPeriod
          ? t("Passer au {v} · {priceString}/{v2}", { v: period === "ANNUAL" ? "annuel" : "mensuel", priceString: selected.priceString, v2: PERIOD_WORD[period] })
          : trialConfirmed
        ? t("Essayer gratuitement pendant {trialDurationLabel}", { trialDurationLabel: trialDurationLabel(trial) })
        : t("S'abonner · {priceString}/{v}", { priceString: selected.priceString, v: PERIOD_WORD[period] });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {onClose ? (
        <View className="flex-row justify-end px-5 pt-2">
          <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button" testID="paywall-close">
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
              animateNextLayout();
              setCompareOpen((v) => !v);
            }}
            activeOpacity={0.7}
            className="flex-row items-center gap-1 self-start py-1"
          >
            <Text className="text-sm font-semibold text-accent">{t("Comparer gratuit et Premium")}</Text>
            <MaterialCommunityIcons name={compareOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} />
          </TouchableOpacity>
          {compareOpen ? <ComparisonCard /> : null}
        </View>

        <View className="gap-2.5" accessibilityRole="radiogroup">
          <PlanCard
            testID="paywall-plan-annual"
            label={t("Annuel")}
            price={loading ? null : storeUnavailable ? "—" : t("{price}/an", { price: annual.priceString })}
            sub={!loading && !storeUnavailable && annual.pricePerMonthString ? t("soit {pricePerMonthString}/mois", { pricePerMonthString: annual.pricePerMonthString }) : null}
            badge={
              currentPeriod === "ANNUAL"
                ? t("Ta formule")
                : savings
                  ? t("Le plus avantageux · −{savings} %", { savings: savings })
                  : t("Le plus avantageux")
            }
            selected={period === "ANNUAL"}
            onPress={() => selectPeriod("ANNUAL")}
          />
          <PlanCard
            testID="paywall-plan-monthly"
            label={t("Mensuel")}
            price={loading ? null : storeUnavailable ? "—" : t("{price}/mois", { price: monthly.priceString })}
            sub={t("sans engagement")}
            badge={currentPeriod === "MONTHLY" ? t("Ta formule") : null}
            selected={period === "MONTHLY"}
            onPress={() => selectPeriod("MONTHLY")}
          />
        </View>

        {trialConfirmed ? <TrialTimeline reminderAt={reminderAt} endAt={trialEnd} priceLine={priceLine} /> : null}

        {onRedeemPromoCode && !currentPeriod ? (
          <PromoCodeField onRedeem={onRedeemPromoCode} onStoreOfferOpened={onStoreOfferOpened} />
        ) : null}
      </ScrollView>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          testID="paywall-cta"
          label={ctaLabel}
          disabled={submitting || loading || isCurrent || storeUnavailable}
          onPress={() => {
            track("paywall_cta_tapped", { placement, period, trial: trialConfirmed });
            onSubscribe(period);
          }}
        />
        {storeUnavailable ? (
          <TouchableOpacity onPress={retryOffer} hitSlop={8} className="py-1">
            <Text className="text-center text-sm font-semibold text-accent">
              {t("Les prix n'ont pas pu être chargés depuis ")}{Platform.OS === "ios" ? t("l'App Store") : t("Google Play")}{t(". Réessayer")}
            </Text>
          </TouchableOpacity>
        ) : (
        <Text className="text-center text-xs leading-4 text-muted">
          {currentPeriod
            ? t("Le changement de formule passe par ton compte {v}, sans double paiement.", { v: Platform.OS === "ios" ? "Apple" : "Google Play" })
            : trialConfirmed
            ? t("Gratuit jusqu'au {formatFullDate}, puis {priceLine}, renouvelé automatiquement.", { formatFullDate: formatFullDate(trialEnd), priceLine: priceLine })
            : t("{priceLine}, renouvelé automatiquement.", { priceLine: priceLine })}{" "}
          {t("Annulable à tout moment dans ")}{CANCEL_WHERE}.
        </Text>
        )}
        {onSkip ? (
          // Lien texte contrasté (text-text) : le palier gratuit permanent doit
          // rester visible à côté du CTA, sans rivaliser avec lui (cf. retour
          // produit du 2026-09-12).
          <TouchableOpacity onPress={skip} disabled={submitting} hitSlop={8} className="py-1" accessibilityRole="button" testID="paywall-free">
            <Text className="text-center text-sm font-semibold text-text underline">{skipLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <View className="flex-row justify-center gap-5">
          <TouchableOpacity onPress={onRestore} disabled={restoring} accessibilityRole="button" testID="paywall-restore">
            <Text className="text-xs font-semibold text-accent">
              {restoring ? t("Restauration…") : t("Restaurer mes achats")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/cgu`).catch(() => {})}>
            <Text className="text-xs font-semibold text-accent">{t("Conditions")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/confidentialite`).catch(() => {})}>
            <Text className="text-xs font-semibold text-accent">{t("Confidentialité")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
