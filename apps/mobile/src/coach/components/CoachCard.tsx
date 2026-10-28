import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { Horse } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { SESSION_META } from "@/lib/sessionContent";
import { track } from "@/lib/analytics";
import { hapticSuccess } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { exerciseById } from "@/coach/exerciseLibrary";
import { buildConstraints } from "@/coach/constraints";
import { buildCoachFacts, dayDiff } from "@/coach/facts";
import { codeSuggestion, plannedSessionFromSuggestion, suggestionRequestBody, type CoachSuggestion } from "@/coach/suggestion";
import { requestSuggestion, type SuggestionResponse } from "@/coach/coachApi";
import { useCoachContext } from "@/coach/useCoachContext";
import { LANG, t } from "@/i18n";

const INTENSITY_LABEL = { LOW: t("légère"), MEDIUM: t("modérée"), HIGH: t("soutenue") } as const;

/** Réponses déjà reçues, par cheval et par jour : la carte se remonte à
 * chaque passage sur l'Accueil sans redemander. */
const memory = new Map<string, SuggestionResponse>();
const pending = new Set<string>();

function dayLabel(targetDate: string): string {
  const [y, m, d] = targetDate.split("-").map(Number);
  const diff = dayDiff(new Date(), new Date(y, m - 1, d));
  if (diff <= 0) return t("Aujourd'hui");
  if (diff === 1) return t("Demain");
  return new Date(y, m - 1, d).toLocaleDateString(LANG === "fr" ? "fr-FR" : "en-GB", { weekday: "long" });
}

/**
 * « Ton coach » (Accueil, sous « Aujourd'hui ») : la prochaine séance du
 * cheval actif. Compte gratuit : la suggestion calculée par l'app, sans
 * explication du coach. Premium : choisie et expliquée par le coach (une
 * fois par jour), avec « Planifier ». Coach en pause : la suggestion de
 * l'app, dite comme telle.
 */
export function CoachCard({ horse }: { horse: Horse }) {
  const colors = useThemeColors();
  const { isActiveOrTrialing } = useSubscription();
  const { addSession } = useSessions();
  const ctx = useCoachContext(horse);
  const [planned, setPlanned] = useState(false);
  const [showExercises, setShowExercises] = useState(false);
  // Incrémenté à l'arrivée d'une réponse : la réponse elle-même est lue dans
  // `memory`, pendant le rendu.
  const [, setVersion] = useState(0);

  const computed = useMemo(() => {
    if (!ctx) return null;
    const facts = buildCoachFacts(ctx);
    const constraints = buildConstraints(facts);
    return { facts, constraints, fallback: codeSuggestion(facts, constraints) };
  }, [ctx]);

  const key = computed ? `${horse.id}:${computed.facts.today}` : null;
  const response = key ? (memory.get(key) ?? null) : null;
  const loading = isActiveOrTrialing && !!key && !response;

  useEffect(() => {
    if (!isActiveOrTrialing || !computed || !key || memory.has(key) || pending.has(key)) return;
    pending.add(key);
    requestSuggestion({ horseId: horse.id, ...suggestionRequestBody(computed.facts, computed.constraints, LANG) })
      .then((r) => {
        memory.set(key, r);
        animateNextLayout();
        setVersion((v) => v + 1);
      })
      .finally(() => pending.delete(key));
    // Une demande par cheval et par jour : `computed` change à chaque saisie,
    // la clé seulement quand le jour ou le cheval change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveOrTrialing, key]);

  if (!computed) return null;
  const s: CoachSuggestion = response?.suggestion ?? computed.fallback;
  const paused = isActiveOrTrialing && (response?.status === "unavailable" || response?.status === "network");
  const quota = response?.status === "quota";
  const exercises = s.exerciseIds.map((id) => exerciseById(id)).filter((e): e is NonNullable<typeof e> => !!e);

  function plan() {
    const session = plannedSessionFromSuggestion(s);
    if (!session || planned) return;
    addSession({ ...session, horseId: horse.id, time: "", customActivityLabel: null });
    hapticSuccess();
    animateNextLayout();
    setPlanned(true);
    track("coach_session_planned", { source: s.source, type: s.sessionType });
  }

  return (
    <FadeInView delay={90}>
      <View className="gap-3 rounded-card bg-surface p-5 shadow-card">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-highlight">
            <MaterialCommunityIcons name="lightbulb-on-outline" size={17} color={colors.primary} />
          </View>
          <Text className="flex-1 text-sm font-bold uppercase tracking-wide text-primary" accessibilityRole="header">
            {t("Ton coach")}
          </Text>
          {loading ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
        </View>

        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{dayLabel(s.targetDate)}</Text>
          <Text className="text-lg font-bold text-text">
            {s.rest || !s.sessionType
              ? t("Repos")
              : t("{title} · {duration} min · {intensity}", {
                  title: SESSION_META[s.sessionType].title,
                  duration: s.durationMin,
                  intensity: INTENSITY_LABEL[s.intensity],
                })}
          </Text>
          {isActiveOrTrialing ? (
            <Text className="text-[15px] leading-5 text-text">{s.reason}</Text>
          ) : (
            <Text className="text-sm leading-5 text-muted">{t("Suggestion calculée d'après ses séances, sa santé et tes concours.")}</Text>
          )}
          {paused ? (
            <Text className="text-xs text-muted">{t("Le coach fait une pause : voici la suggestion calculée par l'app.")}</Text>
          ) : quota ? (
            <Text className="text-xs text-muted">{t("Suggestion du coach déjà donnée aujourd'hui pour tes chevaux : voici celle de l'app.")}</Text>
          ) : null}
        </View>

        {exercises.length > 0 ? (
          <View className="gap-1.5">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: showExercises }}
              onPress={() => {
                animateNextLayout();
                setShowExercises((v) => !v);
              }}
              className="flex-row items-center gap-1"
              hitSlop={6}
            >
              <Text className="text-sm font-semibold text-accent">
                {showExercises ? t("Masquer les exercices") : t("Voir les {n} exercices", { n: exercises.length })}
              </Text>
              <MaterialCommunityIcons name={showExercises ? "chevron-up" : "chevron-down"} size={16} color={colors.accent} />
            </TouchableOpacity>
            {showExercises
              ? exercises.map((e) => (
                  <Text key={e.id} className="text-sm leading-5 text-text">
                    • {e.title.replace(/\*\*/g, "")}
                  </Text>
                ))
              : null}
          </View>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-3">
          {!s.rest ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: planned }}
              disabled={planned}
              onPress={plan}
              activeOpacity={0.85}
              className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${planned ? "bg-success/15" : "bg-primary"}`}
            >
              <MaterialCommunityIcons
                name={planned ? "check" : "calendar-plus"}
                size={16}
                color={planned ? colors.success : colors.textOnPrimary}
              />
              <Text className={`text-sm font-bold ${planned ? "text-success" : "text-on-primary"}`}>
                {planned ? t("Planifiée") : t("Planifier")}
              </Text>
            </TouchableOpacity>
          ) : null}
          {isActiveOrTrialing ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/coach")} hitSlop={6}>
              <Text className="text-sm font-semibold text-accent">{t("Pose une question sur ton cheval")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => openPaywall("coach", { feature: "coach_card", horseId: horse.id })}
              hitSlop={6}
            >
              <Text className="text-sm font-semibold text-accent">{t("Pourquoi cette séance ? Ton coach l'explique avec Premium")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </FadeInView>
  );
}
