import { useMemo, useRef, useState } from "react";
import { Share, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { BrandMark } from "@/components/BrandMark";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { monthName } from "@/lib/progress";
import { DOWNLOAD_URL } from "@/lib/links";
import { track } from "@/lib/analytics";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { computeYearReview, featuredReviewYear, hasYearReview } from "@/review/yearReview";
import { t } from "@/i18n";

/**
 * « Mon année avec {cheval} » — le bilan d'une année, sous forme d'une carte
 * à partager en image (story, message). Uniquement des faits enregistrés
 * (cf. review/yearReview.ts).
 */
export default function YearReviewScreen() {
  const colors = useThemeColors();
  const { id, year: yearParam } = useLocalSearchParams<{ id: string; year?: string }>();
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const { appointments, journal } = useAgenda();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const now = new Date();
  const year = Number(yearParam) || featuredReviewYear(now) || now.getFullYear();
  const horse = horses.find((h) => h.id === id);
  const review = useMemo(
    () => (horse ? computeYearReview({ horseId: horse.id, sessions, appointments, journal }, year, new Date()) : null),
    [horse, sessions, appointments, journal, year]
  );

  if (!horse || !review) {
    return (
      <Screen>
        <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
      </Screen>
    );
  }

  const tiles: { value: string; label: string; show: boolean }[] = [
    { value: String(review.sessions), label: review.sessions > 1 ? t("séances") : t("séance"), show: true },
    { value: String(review.hours), label: t("heures en selle"), show: review.hours > 0 },
    { value: String(review.km), label: t("km parcourus"), show: review.km > 0 },
    { value: String(review.bestStreakWeeks), label: t("semaines d'affilée"), show: review.bestStreakWeeks > 1 },
    { value: String(review.shows), label: review.shows > 1 ? t("concours disputés") : t("concours disputé"), show: review.shows > 0 },
    { value: String(review.care), label: t("soins suivis"), show: review.care > 0 },
    { value: String(review.memories), label: t("souvenirs"), show: review.memories > 0 },
  ].filter((x) => x.show);

  const lines = [
    review.favoriteActivity ? t("Discipline de cœur : {label}", { label: ACTIVITY_META[review.favoriteActivity].label }) : null,
    review.busiestMonth !== null ? t("Mois le plus actif : {month}", { month: monthName(review.busiestMonth).toLowerCase() }) : null,
    review.showResults.length ? t("Résultats : {results}", { results: review.showResults.join(", ") }) : null,
  ].filter((l): l is string => !!l);

  function textSummary(): string {
    return [
      t("Mon année {year} avec {name} 🐴", { year: review!.year, name: horse!.name }),
      ...tiles.map((x) => `• ${x.value} ${x.label}`),
      ...lines.map((l) => `• ${l}`),
      DOWNLOAD_URL ? t("Suivi avec Horsetrack : {downloadUrl}", { downloadUrl: DOWNLOAD_URL }) : t("Suivi avec Horsetrack"),
    ].join("\n");
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    track("year_review_shared", { year: review!.year, sessions: review!.sessions });
    try {
      // Image de la carte ; à défaut (ancien client sans le module natif),
      // le même bilan en texte.
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await runNativeInteraction(() => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" }));
      } else {
        await Share.share({ message: textSummary() });
      }
    } catch {
      await Share.share({ message: textSummary() }).catch(() => {});
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
          {t("Bilan {year}", { year })}
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {hasYearReview(review) ? (
        <>
          <FadeInView>
            {/* Carte capturée telle quelle pour le partage : tout ce qui doit
                figurer sur l'image vit à l'intérieur. */}
            <View ref={cardRef} collapsable={false} className="gap-5 rounded-card bg-primary p-6">
              <View className="gap-1">
                <Text className="text-sm font-semibold text-on-primary opacity-80">{t("Mon année {year} avec", { year })}</Text>
                <Text className="text-3xl font-display-bold text-on-primary">{horse.name}</Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                {tiles.map((x) => (
                  <View key={x.label} className="min-w-[45%] flex-1 rounded-card bg-on-primary/10 p-4">
                    <Text className="text-3xl font-display-bold text-on-primary">{x.value}</Text>
                    <Text className="text-sm text-on-primary opacity-80">{x.label}</Text>
                  </View>
                ))}
              </View>
              {lines.length ? (
                <View className="gap-1.5">
                  {lines.map((l) => (
                    <Text key={l} className="text-base font-semibold text-on-primary">
                      {l}
                    </Text>
                  ))}
                </View>
              ) : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-on-primary opacity-70">horsetrack.fr</Text>
                <BrandMark size={22} style={{ tintColor: colors.textOnPrimary }} />
              </View>
            </View>
          </FadeInView>
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-4"
            accessibilityRole="button"
            onPress={() => void handleShare()}
            disabled={sharing}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color={colors.textOnPrimary} />
            <Text className="text-base font-bold text-on-primary">{sharing ? t("Préparation…") : t("Partager mon année")}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View className="rounded-card bg-surface p-5 shadow-card">
          <Text className="text-sm text-muted">
            {t("Pas encore assez de séances, concours ou souvenirs en {year} pour un bilan. Coche tes séances au fil de l'année : il se remplira tout seul.", { year })}
          </Text>
        </View>
      )}
    </Screen>
  );
}
