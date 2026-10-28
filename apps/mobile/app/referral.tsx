import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { DOWNLOAD_URL } from "@/lib/links";
import { track } from "@/lib/analytics";
import { hapticSuccess } from "@/lib/haptics";
import { claimReferralCode, fetchReferral, type ClaimResult, type ReferralInfo } from "@/lib/referral";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

const CLAIM_MESSAGE: Record<Exclude<ClaimResult, "ok">, string> = {
  invalid: t("Ce code n'existe pas. Vérifie-le avec ton ami."),
  own_code: t("C'est ton propre code : partage-le plutôt !"),
  too_old: t("Le code d'un ami se saisit dans les 30 jours après l'inscription."),
  already_referred: t("Tu as déjà été parrainé·e."),
  already_subscriber: t("Ton compte est déjà abonné : le parrainage concerne les nouveaux cavaliers."),
  network: t("Pas de connexion. Réessaie dans un instant."),
};

/**
 * Parrainage : ton code à partager — un mois de Premium offert pour toi dès
 * que l'ami parrainé s'abonne (cf. apps/api/src/lib/referrals.ts) — et, pour
 * un compte récent, la saisie du code de l'ami qui t'a fait découvrir l'app.
 */
export default function ReferralScreen() {
  const colors = useThemeColors();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  const load = useCallback(async () => {
    const data = await fetchReferral();
    setFailed(!data);
    if (data) setInfo(data);
  }, []);

  // Chargement à l'ouverture : l'état ne change qu'à la réponse du serveur.
  useEffect(() => {
    let cancelled = false;
    fetchReferral().then((data) => {
      if (cancelled) return;
      setFailed(!data);
      if (data) setInfo(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleShare() {
    if (!info) return;
    track("referral_shared");
    await Share.share({
      message: t("Je suis mon cheval avec Horsetrack. Utilise mon code {code} à l'inscription : {url}", {
        code: info.code,
        url: DOWNLOAD_URL ?? "horsetrack.fr",
      }),
    }).catch(() => {});
  }

  async function handleClaim() {
    if (!code.trim() || claiming) return;
    setClaiming(true);
    const result = await claimReferralCode(code);
    setClaiming(false);
    setClaimResult(result);
    track("referral_claimed", { result });
    if (result === "ok") {
      hapticSuccess();
      void load();
    }
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
          {t("Parrainer un ami")}
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {!info && !failed ? <ActivityIndicator color={colors.primary} /> : null}

      {failed ? (
        <View className={`${CARD} gap-3`}>
          <Text className="text-sm text-muted">{t("Impossible de charger ton parrainage. Vérifie ta connexion.")}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void load()}>
            <Text className="text-sm font-semibold text-accent">{t("Réessayer")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {info ? (
        <>
          <FadeInView>
            <View className={`${CARD} items-center gap-3`}>
              <MaterialCommunityIcons name="gift-outline" size={32} color={colors.primary} />
              <Text className="text-center text-base text-text">
                {t("Un mois de Premium offert pour toi chaque fois qu'un ami parrainé s'abonne.")}
              </Text>
              <Text
                className="text-4xl font-display-bold tracking-widest text-primary"
                accessibilityLabel={t("Ton code : {code}", { code: info.code.split("").join(" ") })}
                selectable
              >
                {info.code}
              </Text>
              <PrimaryButton label={t("Partager mon code")} onPress={() => void handleShare()} />
              <Text className="text-center text-xs text-muted">
                {t("{invited} ami(s) inscrit(s) avec ton code · {rewarded} mois offert(s)", {
                  invited: info.invited,
                  rewarded: info.rewarded,
                })}
              </Text>
            </View>
          </FadeInView>

          {info.referredBy ? (
            <Text className="text-center text-sm text-muted">
              {t("Tu as été parrainé·e avec le code {code}.", { code: info.referredBy })}
            </Text>
          ) : info.canClaim ? (
            <FadeInView delay={60}>
              <View className={`${CARD} gap-3`}>
                <Text className="text-base font-semibold text-text">{t("Un ami t'a fait découvrir Horsetrack ?")}</Text>
                <TextInput
                  className={INPUT}
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.toUpperCase());
                    setClaimResult(null);
                  }}
                  placeholder={t("Son code")}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={10}
                />
                {claimResult && claimResult !== "ok" ? (
                  <Text className="text-sm text-danger" accessibilityLiveRegion="polite">
                    {CLAIM_MESSAGE[claimResult]}
                  </Text>
                ) : null}
                <PrimaryButton label={claiming ? t("Vérification…") : t("Valider")} onPress={() => void handleClaim()} disabled={!code.trim() || claiming} />
              </View>
            </FadeInView>
          ) : null}
          {claimResult === "ok" ? (
            <Text className="text-center text-sm font-semibold text-success">{t("Merci ! Ton ami sera récompensé quand tu t'abonneras.")}</Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
