import { useEffect, useState } from "react";
import { Alert, Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { supabase } from "@/lib/supabase";
import { readJson, writeJson } from "@/lib/localStore";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSubscription } from "@/subscription/store";
import { formatFullDate } from "@/subscription/paywallLogic";
import { noteWinbackOfferShown } from "@/subscription/promoContext";
import { t } from "@/i18n";

type WinbackOffer = { code: string; headline: string | null; description: string | null; expiresAt: string | null };

const DISMISS_KEY = "winback_dismissed_v1";
/** Masquée à la demande, l'offre ne revient pas avant ce délai. */
const DISMISS_DAYS = 14;

/**
 * Offre de retour, pour un compte redevenu gratuit (fin d'essai sans achat,
 * abonnement résilié). Le serveur décide seul s'il y en a une et laquelle
 * (cf. apps/api /api/promo/winback) : un code « Remise sur l'abonnement » de
 * la campagne « retour », créé dans /admin et dans App Store Connect.
 *
 * L'utiliser passe par le parcours de code promo habituel : Horsetrack
 * vérifie le code, puis ouvre la feuille officielle de l'App Store, qui
 * affiche le prix remisé et facture. Aucun prix n'est calculé ici.
 */
export function WinbackCard() {
  const colors = useThemeColors();
  const { loading, isActiveOrTrialing, redeemPromoCode } = useSubscription();
  const [offer, setOffer] = useState<WinbackOffer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || isActiveOrTrialing) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/promo/winback`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json().catch(() => null)) as { offer?: WinbackOffer | null } | null;
      const next = json?.offer;
      if (!next || typeof next.code !== "string") return;
      const dismissed = await readJson<{ code: string; at: string } | null>(DISMISS_KEY, null);
      if (dismissed?.code === next.code && Date.now() - new Date(dismissed.at).getTime() < DISMISS_DAYS * 86400000) return;
      if (cancelled) return;
      animateNextLayout();
      setOffer(next);
      track("winback_offer_viewed", { code: next.code });
      noteWinbackOfferShown(next.code);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading, isActiveOrTrialing]);

  if (!offer || isActiveOrTrialing) return null;

  async function claim() {
    if (!offer || busy) return;
    hapticTap();
    setBusy(true);
    track("winback_offer_tapped", { code: offer.code });
    const result = await redeemPromoCode(offer.code);
    setBusy(false);
    if (result.ok && result.redeemUrl) {
      track("promo_store_redeem_opened", { source: "winback" });
      Linking.openURL(result.redeemUrl).catch(() => {});
    } else {
      Alert.alert(t("Offre indisponible"), result.message);
    }
  }

  function dismiss() {
    if (!offer) return;
    track("winback_offer_dismissed", { code: offer.code });
    writeJson(DISMISS_KEY, { code: offer.code, at: new Date().toISOString() }).catch(() => {});
    animateNextLayout();
    setOffer(null);
  }

  const expires = offer.expiresAt ? new Date(offer.expiresAt) : null;

  return (
    <View className="gap-3 rounded-card bg-primary p-5">
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs font-bold uppercase tracking-wide text-on-primary/80">{t("Offre de retour")}</Text>
          <Text className="text-xl font-display text-on-primary">
            {offer.headline ? t("{headline} pour revenir sur Premium", { headline: offer.headline }) : t("Une offre pour revenir sur Premium")}
          </Text>
          {offer.description ? <Text className="text-sm text-on-primary/85">{offer.description}</Text> : null}
          {expires ? (
            <Text className="text-xs text-on-primary/70">{t("Jusqu'au ")}{formatFullDate(expires)}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Masquer l'offre")}>
          <MaterialCommunityIcons name="close" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={claim}
        disabled={busy}
        activeOpacity={0.85}
        accessibilityRole="button"
        className="items-center rounded-full bg-surface p-3.5"
      >
        <Text className="text-base font-bold text-primary">{busy ? t("Vérification…") : t("En profiter")}</Text>
      </TouchableOpacity>
      <Text className="text-center text-xs text-on-primary/70">
        {t("Le prix et la durée s'affichent sur ")}{Platform.OS === "android" ? t("Google Play") : t("l'App Store")} {t(" avant toute confirmation.")}
      </Text>
    </View>
  );
}
