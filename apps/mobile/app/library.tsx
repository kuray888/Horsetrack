import { useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { DISCIPLINES } from "@/onboarding/options";
import type { Discipline } from "@/onboarding/store";
import { SESSION_META, type SessionStepPhase } from "@/lib/sessionContent";
import { track } from "@/lib/analytics";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { formatDate } from "@/lib/dateFormat";
import { SESSION_TYPE_INFO, exerciseNoteLine, filterLibrary, libraryExercises, type LibraryExercise } from "@/coach/exerciseLibrary";
import { toggleFavorite, useFavorites } from "@/coach/favorites";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-4 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-3.5 text-base text-text";

const PHASE_LABEL: Record<SessionStepPhase, string> = {
  ECHAUFFEMENT: t("Échauffement"),
  CORPS_DE_SEANCE: t("Corps de séance"),
  RETOUR_AU_CALME: t("Retour au calme"),
};

/** Texte enrichi des exercices : **gras** → gras. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text className="text-sm leading-5 text-text">
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <Text key={i} className="font-semibold">
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        )
      )}
    </Text>
  );
}

function close() {
  if (router.canGoBack()) router.back();
  else router.dismissTo("/(tabs)/planning");
}

/**
 * Bibliothèque d'exercices : celle dont se sert le coach (cf.
 * coach/exerciseLibrary.ts), consultable, cherchable et filtrable. Un
 * exercice s'ajoute en un toucher à la prochaine séance prévue du cheval
 * actif (dans ses notes), ou crée une séance aujourd'hui.
 */
export default function LibraryScreen() {
  const colors = useThemeColors();
  const { selectedHorse } = useHorses();
  const { sessions, addSession, updateSession } = useSessions();
  const favorites = useFavorites();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<Discipline | null>(selectedHorse?.discipline ?? null);
  const [noEquipment, setNoEquipment] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(
    () =>
      filterLibrary(libraryExercises(), {
        query,
        discipline,
        horseLevel: selectedHorse?.level ?? null,
        noEquipment,
        favoritesOnly,
        favorites,
      }),
    [query, discipline, noEquipment, favoritesOnly, favorites, selectedHorse?.level]
  );

  // Prochaine séance prévue du cheval actif (aujourd'hui compris).
  const nextPlanned = useMemo(() => {
    if (!selectedHorse) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (
      sessions
        .filter((s) => s.horseId === selectedHorse.id && !s.completed && s.date >= today)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
    );
  }, [sessions, selectedHorse]);

  function addTo(e: LibraryExercise) {
    if (!selectedHorse) return;
    const line = exerciseNoteLine(e);
    const done = (where: string) => {
      hapticSuccess();
      track("exercise_added_to_session", { type: e.type, where });
      Alert.alert(t("Exercice ajouté"), where === "existing" ? t("Il figure dans les notes de la séance.") : t("Une séance prévue aujourd'hui a été créée."));
    };
    const buttons: { text: string; style?: "cancel"; onPress?: () => void }[] = [];
    if (nextPlanned) {
      buttons.push({
        text: t("Séance du {date}", { date: formatDate(nextPlanned.date) }),
        onPress: () => {
          const notes = nextPlanned.notes.trim() ? `${nextPlanned.notes.trim()}\n${line}` : line;
          updateSession({ ...nextPlanned, notes });
          done("existing");
        },
      });
    }
    buttons.push({
      text: t("Nouvelle séance aujourd'hui"),
      onPress: () => {
        addSession({
          horseId: selectedHorse.id,
          activityType: SESSION_TYPE_INFO[e.type].activity,
          customActivityLabel: null,
          date: new Date(),
          time: "",
          durationMinutes: SESSION_META[e.type].baseDurationMin,
          intensity: null,
          notes: line,
        });
        done("new");
      },
    });
    buttons.push({ text: t("Annuler"), style: "cancel" });
    Alert.alert(t("Ajouter à une séance de {name}", { name: selectedHorse.name }), e.title.replace(/\*\*/g, ""), buttons);
  }

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      className={`rounded-full px-3 py-1.5 ${active ? "bg-primary" : "border border-border bg-surface"}`}
    >
      <Text className={`text-xs font-semibold ${active ? "text-on-primary" : "text-text"}`}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Bibliothèque d'exercices")}
            </Text>
            <Text className="text-sm text-muted">
              {t("{n} exercices, ceux que le coach utilise pour tes séances.", { n: libraryExercises().length })}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Fermer")} onPress={close} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      <TextInput
        className={INPUT}
        value={query}
        onChangeText={setQuery}
        placeholder={t("Chercher : volte, barres, longe…")}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t("Chercher un exercice")}
        autoCorrect={false}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {chip(t("Favoris"), favoritesOnly, () => setFavoritesOnly((v) => !v))}
        {chip(t("Sans matériel"), noEquipment, () => setNoEquipment((v) => !v))}
        {chip(t("Toutes disciplines"), discipline === null, () => setDiscipline(null))}
        {DISCIPLINES.map((d) => chip(d.label, discipline === d.value, () => setDiscipline(d.value)))}
      </ScrollView>

      {results.length === 0 ? (
        <Text className="text-sm text-muted">{t("Aucun exercice ne correspond.")}</Text>
      ) : (
        results.map((e) => {
          const open = openId === e.id;
          const fav = favorites.has(e.id);
          return (
            <View key={e.id} className={`${CARD} gap-2`}>
              <View className="flex-row items-start gap-2">
                <TouchableOpacity
                  className="flex-1 gap-0.5"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => {
                    animateNextLayout();
                    setOpenId(open ? null : e.id);
                  }}
                >
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {e.sessionTitle} · {PHASE_LABEL[e.phase]}
                  </Text>
                  <Text className="text-[15px] font-semibold text-text">{e.title.replace(/\*\*/g, "")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={fav ? t("Retirer des favoris") : t("Ajouter aux favoris")}
                  hitSlop={8}
                  onPress={() => {
                    hapticTap();
                    if (toggleFavorite(e.id)) track("exercise_favorited", { type: e.type });
                  }}
                >
                  <MaterialCommunityIcons name={fav ? "star" : "star-outline"} size={22} color={fav ? colors.warning : colors.textMuted} />
                </TouchableOpacity>
              </View>
              {open ? (
                <View className="gap-2">
                  <RichText text={e.description} />
                  <Text className="text-xs text-muted">
                    {t("Matériel : {list}", { list: e.equipment.map((x) => x.replace(/\*\*/g, "")).join(", ") })}
                  </Text>
                  {e.videoUrl ? (
                    <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(e.videoUrl!)}>
                      <Text className="text-sm font-semibold text-accent">{t("Voir la vidéo")}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {selectedHorse ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => addTo(e)}
                      className="flex-row items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2"
                    >
                      <MaterialCommunityIcons name="plus" size={16} color={colors.textOnPrimary} />
                      <Text className="text-sm font-bold text-on-primary">{t("Ajouter à une séance")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}
