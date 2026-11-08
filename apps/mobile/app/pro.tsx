import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { PlanCard } from "@/components/PaywallView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSubscribeFlow, useSubscription, type BillingPeriod } from "@/subscription/store";
import { usePaywallOfferState } from "@/subscription/paywall";
import { DEFAULT_TRIAL, parseTrialPeriod, trialDurationLabel } from "@/subscription/paywallLogic";
import { openManageSubscriptions } from "@/lib/revenuecat";
import { legalUrl, openLegalPage, type LegalPage } from "@/lib/links";
import { track } from "@/lib/analytics";
import { hapticSelection } from "@/lib/haptics";
import { t } from "@/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const PERIOD_WORD: Record<BillingPeriod, string> = { MONTHLY: "mois", ANNUAL: "an" };
const CANCEL_WHERE = Platform.OS === "ios" ? t("Réglages > Abonnements") : t("Google Play > Abonnements");

/** Ce qu'Écurie Pro ajoute à Premium — chaque ligne est réellement
 * appliquée (serveur : apps/api/src/lib/plans.ts, rls.sql ; app : Vue écurie). */
const PRO_FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "account-group-outline",
    title: t("Jusqu'à 5 personnes par cheval"),
    text: t("Demi-pensions, coach, groom, vétérinaire : chacun suit le planning et les soins."),
  },
  {
    icon: "view-dashboard-outline",
    title: t("Vue écurie"),
    text: t("Tous tes chevaux sur un écran : soins en retard, prochaines échéances, séances de la semaine, dépenses du mois."),
  },
  {
    icon: "lightbulb-on-outline",
    title: t("Coach ×3"),
    text: t("100 questions par mois et des suggestions de séance pour 10 chevaux par jour."),
  },
  {
    icon: "star-outline",
    title: t("Tout Premium inclus"),
    text: t("Chevaux illimités, rappels avant chaque soin, coffre-fort, budget, sécurité en balade."),
  },
];

/**
 * Paywall d'Écurie Pro. Mêmes règles que celui de Premium (cf. PaywallView) :
 * prix et essai lus dans le store, montant facturé le plus visible,
 * renouvellement et résiliation expliqués, restauration et pages légales.
 */
export default function ProPaywall() {
  const colors = useThemeColors();
  const { isPro, isActiveOrTrialing, promotional } = useSubscription();
  const { submitting, subscribe, restoring, restore } = useSubscribeFlow();
  const { offer, retry } = usePaywallOfferState("pro");
  const [period, setPeriod] = useState<BillingPeriod>("ANNUAL");
  const viewed = useRef(false);
  const premiumSubscriber = isActiveOrTrialing && !promotional && !isPro;

  const loading = offer === undefined;
  const unavailable = !loading && !(offer?.MONTHLY && offer?.ANNUAL);
  const selected = offer?.[period];
  const trialConfirmed = !isActiveOrTrialing && selected?.trialEligible === true;
  const trial = parseTrialPeriod(selected?.trialUnit, selected?.trialCount) ?? DEFAULT_TRIAL;
  const priceLine = selected ? t("{priceString} par {v}", { priceString: selected.priceString, v: PERIOD_WORD[period] }) : "";

  useEffect(() => {
    if (loading || viewed.current) return;
    viewed.current = true;
    track("pro_paywall_viewed", { premium: premiumSubscriber, store_prices: !unavailable });
  }, [loading, premiumSubscriber, unavailable]);

  function select(p: BillingPeriod) {
    if (p !== period) hapticSelection();
    setPeriod(p);
  }

  async function openLegal(page: LegalPage) {
    if (await openLegalPage(page)) return;
    const url = legalUrl(page);
    Alert.alert(t("Impossible d'ouvrir"), url ? t("Tu peux la lire sur {url}", { url }) : t("Réessaie dans un instant."));
  }

  const ctaLabel = submitting
    ? t("Un instant…")
    : loading
      ? t("Chargement de l'offre…")
      : unavailable
        ? t("Offre indisponible pour le moment")
        : trialConfirmed
          ? t("Essayer gratuitement pendant {trialDurationLabel}", { trialDurationLabel: trialDurationLabel(trial) })
          : premiumSubscriber
            ? t("Passer à Écurie Pro · {priceString}/{v}", { priceString: selected!.priceString, v: PERIOD_WORD[period] })
            : t("S'abonner · {priceString}/{v}", { priceString: selected!.priceString, v: PERIOD_WORD[period] });

  if (isPro) {
    return (
      <SafeAreaView className="flex-1 justify-center gap-5 bg-background px-6" edges={["top", "bottom"]}>
        <View className="gap-2">
          <Text className="text-2xl font-display tracking-tight text-text">{t("Écurie Pro est active")}</Text>
          <Text className="text-base text-muted">{t("Toutes les fonctionnalités Pro sont débloquées sur ton compte.")}</Text>
        </View>
        <PrimaryButton label={t("Ouvrir la vue écurie")} onPress={() => router.replace("/ecurie")} />
        <TouchableOpacity onPress={() => void openManageSubscriptions()} className="items-center py-2">
          <Text className="text-sm font-semibold text-accent">{t("Gérer mon abonnement")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row justify-end px-5 pt-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button" testID="pro-close">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-4 gap-6" showsVerticalScrollIndicator={false}>
        <FadeInView>
          <View className="gap-3">
            <View className="self-start rounded-full bg-primary px-3 py-1">
              <Text className="text-xs font-bold uppercase tracking-wide text-on-primary">{t("Écurie Pro")}</Text>
            </View>
            <Text className="text-3xl font-display leading-tight tracking-tight text-text">
              {t("Toute ton écurie, et tous ceux qui s'en occupent.")}
            </Text>
            <Text className="text-base text-muted">
              {t("Pour plusieurs chevaux, plusieurs demi-pensions, ou un coach qui suit tes cavaliers.")}
            </Text>
          </View>
        </FadeInView>

        <View className="gap-4">
          {PRO_FEATURES.map((f, i) => (
            <FadeInView key={f.title} delay={80 + i * 60}>
              <View className="flex-row gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                  <MaterialCommunityIcons name={f.icon} size={20} color={colors.primary} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[15px] font-bold text-text">{f.title}</Text>
                  <Text className="text-[13px] leading-5 text-muted">{f.text}</Text>
                </View>
              </View>
            </FadeInView>
          ))}
        </View>

        <View className="gap-3" accessibilityRole="radiogroup">
          <PlanCard
            testID="pro-plan-annual"
            label={t("Annuel")}
            price={loading ? null : unavailable ? "—" : t("{price}/an", { price: offer!.ANNUAL!.priceString })}
            sub={!loading && !unavailable && offer!.ANNUAL!.pricePerMonthString ? t("soit {pricePerMonthString}/mois", { pricePerMonthString: offer!.ANNUAL!.pricePerMonthString }) : null}
            badge={t("Le plus avantageux")}
            selected={period === "ANNUAL"}
            onPress={() => select("ANNUAL")}
          />
          <PlanCard
            testID="pro-plan-monthly"
            label={t("Mensuel")}
            price={loading ? null : unavailable ? "—" : t("{price}/mois", { price: offer!.MONTHLY!.priceString })}
            sub={t("sans engagement")}
            badge={null}
            selected={period === "MONTHLY"}
            onPress={() => select("MONTHLY")}
          />
        </View>

        {premiumSubscriber ? (
          <Text className="text-sm leading-5 text-muted">
            {t("Ton abonnement Premium est remplacé par Écurie Pro, sans double paiement : le store ajuste au prorata.")}
          </Text>
        ) : null}
      </ScrollView>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          testID="pro-cta"
          label={ctaLabel}
          disabled={submitting || loading || unavailable}
          onPress={() => {
            track("pro_cta_tapped", { period, premium: premiumSubscriber, trial: trialConfirmed });
            void subscribe(period, () => router.replace("/ecurie"), "pro", "pro");
          }}
        />
        {unavailable ? (
          <TouchableOpacity onPress={retry} hitSlop={8} className="py-1">
            <Text className="text-center text-sm font-semibold text-accent">{t("Les prix n'ont pas pu être chargés. Réessayer")}</Text>
          </TouchableOpacity>
        ) : (
          <Text className="text-center text-xs leading-4 text-muted">
            {trialConfirmed
              ? t("Gratuit pendant {d}, puis {priceLine}, renouvelé automatiquement.", { d: trialDurationLabel(trial), priceLine })
              : t("{priceLine}, renouvelé automatiquement.", { priceLine })}{" "}
            {t("Annulable à tout moment dans ")}{CANCEL_WHERE}.
          </Text>
        )}
        <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-1">
          <TouchableOpacity onPress={restore} disabled={restoring} hitSlop={12} accessibilityRole="button">
            <Text className="text-xs font-semibold text-accent">{restoring ? t("Restauration…") : t("Restaurer mes achats")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void openLegal("terms")} hitSlop={12} accessibilityRole="link">
            <Text className="text-xs font-semibold text-accent">{t("Conditions d'utilisation")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void openLegal("privacy")} hitSlop={12} accessibilityRole="link">
            <Text className="text-xs font-semibold text-accent">{t("Politique de confidentialité")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
