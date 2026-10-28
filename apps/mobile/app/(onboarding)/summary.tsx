import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { useThemeColors } from "@/theme/ThemeProvider";
import { horsePreview } from "@/onboarding/horsePreview";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES } from "@/onboarding/options";
import { track } from "@/lib/analytics";
import { joinNames } from "@/subscription/paywallLogic";
import { t } from "@/i18n";

/** Minuscule initiale seulement : « Saut d'obstacles (CSO) » devenait
 * « saut d'obstacles (cso) » avec un toLowerCase() sur tout le libellé. */
function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function PlanRow({ text, premium = false }: { text: string; premium?: boolean }) {
  return (
    <View className="flex-row items-start gap-3 py-2.5">
      <Text className={`text-base ${premium ? "text-primary" : "text-success"}`}>{premium ? "★" : "✓"}</Text>
      <Text className="flex-1 text-base text-text">{text}</Text>
    </View>
  );
}

/** Ce que la fiche fera vivre dès le premier jour — des espaces, pas des
 * données : rien n'est inventé au nom du cavalier. */
const HUB_MODULES: { icon: "needle" | "calendar-check" | "notebook-outline" | "wallet-outline"; title: string; hint: string }[] = [
  { icon: "needle", title: t("Santé"), hint: t("Soins et prochaines échéances") },
  { icon: "calendar-check", title: t("Séances"), hint: t("Planning et séances en direct") },
  { icon: "notebook-outline", title: t("Journal"), hint: t("Souvenirs et photos") },
  { icon: "wallet-outline", title: t("Budget"), hint: t("Dépenses du mois") },
];

/**
 * Aperçu de la fiche, avant le paywall : la première chose concrète que
 * l'app rend au cavalier, avec ce qu'il vient de saisir (cf.
 * onboarding/horsePreview.ts). Avant, le paywall arrivait sur une simple
 * liste de fonctionnalités, avant toute valeur perçue.
 */
function HorsePreviewCard({ preview, photoUrl }: { preview: ReturnType<typeof horsePreview>; photoUrl: string | null }) {
  const colors = useThemeColors();
  return (
    <View
      className="gap-4 rounded-card bg-surface p-5 shadow-card"
      accessible
      accessibilityLabel={[t("Fiche de {name}", { name: preview.name }), preview.subtitle, ...preview.facts.map((f) => `${f.label} ${f.value}`)]
        .filter(Boolean)
        .join(", ")}
    >
      <View className="flex-row items-center gap-4">
        <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-highlight">
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={{ width: 80, height: 80 }} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="horse-variant" size={34} color={colors.primary} />
          )}
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-2xl font-display tracking-tight text-text" numberOfLines={1}>
            {preview.name}
          </Text>
          <Text className="text-sm text-muted">{preview.subtitle ?? t("Sa fiche se complète quand tu veux.")}</Text>
        </View>
      </View>

      {preview.facts.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {preview.facts.map((f) => (
            <View key={f.label} className="rounded-full bg-highlight px-3 py-1.5">
              <Text className="text-xs text-muted">
                {f.label} <Text className="font-semibold text-text">{f.value}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2.5">
        {HUB_MODULES.map((m) => (
          <View key={m.title} className="min-w-[45%] flex-1 flex-row items-center gap-2.5 rounded-card border border-border p-3">
            <MaterialCommunityIcons name={m.icon} size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text">{m.title}</Text>
              <Text className="text-xs text-muted" numberOfLines={2}>
                {m.hint}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Summary() {
  const { rider, horses } = useOnboarding();
  const primary = horses.find((h) => h.isPrimary) ?? horses[0];
  const horseName = primary?.name?.trim() || t("ton cheval");
  const disciplineLabel = DISCIPLINES.find((d) => d.value === (primary?.discipline ?? rider.mainDiscipline))?.label;
  const focus = primary?.weaknesses?.[0];
  const namedHorses = horses.filter((h) => h.name.trim().length > 0).map((h) => h.name.trim());
  const preview = primary ? horsePreview(primary, rider.mainDiscipline, new Date()) : null;

  useEffect(() => {
    track("onboarding_step_viewed", { step: "summary", horse_count: namedHorses.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="px-5 pt-8 pb-4 gap-5" showsVerticalScrollIndicator={false}>
        <FadeInView>
          <View className="gap-2">
            <Text className="text-3xl font-display leading-tight tracking-tight text-text">
              {t("L'écurie de ")}{horseName} {t(" est prête 🎉")}
            </Text>
            <Text className="text-base text-muted">
              {/* L'objectif n'est plus demandé à l'inscription (cf.
                  onboarding/options.ts TOTAL_STEPS). */}
              {disciplineLabel
                ? t("Tout est prêt pour progresser ensemble en {lowerFirst}.", { lowerFirst: lowerFirst(disciplineLabel) })
                : t("Tout est prêt pour progresser ensemble.")}
            </Text>
          </View>
        </FadeInView>

        {preview ? (
          <FadeInView delay={80}>
            <HorsePreviewCard preview={preview} photoUrl={primary?.photoUrl ?? null} />
          </FadeInView>
        ) : null}

        <FadeInView delay={120}>
          <View className="rounded-card bg-surface p-5 shadow-card">
            {/* Deux blocs distincts : ce qui est inclus gratuitement, et ce que
                Premium ajoute — l'ancienne liste unique annonçait rappels et
                multi-chevaux comme acquis, juste avant le paywall qui les
                présentait comme payants. */}
            <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">{t("Inclus gratuitement")}</Text>
            <PlanRow text={t("Planifie les séances de {horseName}", { horseName: horseName })} />
            {focus ? <PlanRow text={t("Point à travailler : {v}", { v: t(focus).toLowerCase() })} /> : null}
            <PlanRow text={t("Note les rendez-vous santé : véto, maréchal, ostéo, dentiste")} />
            <PlanRow text={t("Un rappel offert pour ton prochain soin")} />
            <PlanRow text={t("Prépare tes concours et suis tes dépenses")} />
          </View>
        </FadeInView>

        <FadeInView delay={170}>
          <View className="rounded-card border border-primary/30 bg-highlight/40 p-5">
            <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-primary">{t("Avec Premium")}</Text>
            <PlanRow premium text={t("Un rappel avant chaque soin, sans limite")} />
            {namedHorses.length > 1 ? (
              <PlanRow premium text={t("{joinNames} suivis dans la même écurie", { joinNames: joinNames(namedHorses) })} />
            ) : (
              <PlanRow premium text={t("Tous tes chevaux, sans limite")} />
            )}
            <PlanRow premium text={t("Ordonnances et factures rangées au même endroit")} />
            <PlanRow premium text={t("Partage avec ta demi-pension ou ton coach")} />
          </View>
        </FadeInView>

      </ScrollView>

      <FadeInView delay={300}>
        <View className="px-5 pb-2 pt-3">
          <PrimaryButton label={t("Continuer")} onPress={() => router.push("/(onboarding)/paywall")} />
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}
