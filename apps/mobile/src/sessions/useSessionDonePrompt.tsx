import { useEffect, useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSessions, type TrainingSession } from "@/sessions/store";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { animateNextLayout, prefersReducedMotion } from "@/lib/motion";
import { sessionDoneMessage, weekProgress } from "@/lib/progress";
import { computeMilestones, newlyUnlocked } from "@/horses/milestones";
import { useHorses } from "@/horses/store";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

/** Combien de temps l'invite reste à l'écran. Assez pour être vue et
 * comprise, assez peu pour ne pas encombrer un écran qu'on parcourt. */
const PROMPT_MS = 8000;

/**
 * « Séance faite ✓ — un mot dessus ? »
 *
 * Une séance et une entrée de journal décrivent le même moment, mais vivaient
 * dans deux silos : raconter sa séance obligeait à tout ressaisir dans un
 * autre onglet, et le journal restait vide. Cocher une séance est justement
 * l'instant où l'on a quelque chose à en dire.
 *
 * Volontairement une INVITE et non une étape obligatoire : cocher reste un
 * geste d'un seul appui, l'invite s'efface toute seule, et rien n'est créé
 * tant que l'utilisateur ne l'a pas remplie (cf. app/session-note-modal.tsx).
 * Elle n'apparaît qu'en cochant — décocher une séance ne propose rien.
 */
export function useSessionDonePrompt() {
  const { toggleCompleted } = useSessions();
  const [prompted, setPrompted] = useState<TrainingSession | null>(null);

  useEffect(() => {
    if (!prompted) return;
    const timer = setTimeout(() => {
      animateNextLayout();
      setPrompted(null);
    }, PROMPT_MS);
    return () => clearTimeout(timer);
  }, [prompted]);

  /** À appeler à la place de `toggleCompleted` partout où une séance se coche. */
  function toggleSessionDone(session: TrainingSession) {
    // Cocher est LE geste quotidien de l'app : il doit se sentir. Décocher
    // reste discret.
    if (session.completed) hapticTap();
    else hapticSuccess();
    animateNextLayout();
    toggleCompleted(session.id);
    // `session.completed` est l'état AVANT bascule : on ne propose un mot que
    // quand la séance vient d'être marquée faite.
    setPrompted(session.completed ? null : session);
  }

  return { toggleSessionDone, prompted, dismissPrompt: () => setPrompted(null) };
}

/** Bandeau de l'invite (cf. useSessionDonePrompt). Ne rend rien sans invite
 * en cours, pour que les écrans puissent le poser sans condition. */
export function SessionDonePrompt({
  session,
  onDismiss,
}: {
  session: TrainingSession | null;
  onDismiss: () => void;
}) {
  if (!session) return null;
  // Remonté à chaque nouvelle séance cochée (`key`) : la coche rejoue son
  // animation au lieu de rester figée d'une séance à l'autre.
  return <SessionDoneBanner key={session.id} session={session} onDismiss={onDismiss} />;
}

function SessionDoneBanner({ session, onDismiss }: { session: TrainingSession; onDismiss: () => void }) {
  const colors = useThemeColors();
  const { sessions } = useSessions();
  // Lu dans le store (déjà à jour) plutôt que sur `session`, qui est l'état
  // d'avant la bascule.
  const { horses } = useHorses();
  const progress = sessionDoneMessage(weekProgress(sessions, session.horseId, session.date));
  // Badge obtenu grâce à CETTE séance (10 séances, 10 heures…) : il passe avant
  // le message de la semaine. Calculé une fois, au montage du bandeau.
  const [milestone] = useState(() => {
    if (!session.horseId) return null;
    const before = sessions.map((s) => (s.id === session.id ? { ...s, completed: false } : s));
    const unlocked = newlyUnlocked(
      computeMilestones({ horseId: session.horseId, sessions: before }),
      computeMilestones({ horseId: session.horseId, sessions })
    )[0];
    return unlocked ?? null;
  });
  const horseName = horses.find((h) => h.id === session.horseId)?.name;
  useEffect(() => {
    if (milestone) track("milestone_unlocked", { milestone: milestone.id });
  }, [milestone]);
  const text = milestone
    ? t("Nouveau badge{v} : {v2} {emoji}", { v: horseName ? ` avec ${horseName}` : "", v2: milestone.title.toLowerCase(), emoji: milestone.emoji })
    : progress.text;
  const weekComplete = !!milestone || progress.weekComplete;
  const [scale] = useState(() => new Animated.Value(prefersReducedMotion() ? 1 : 0.4));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 16 }).start();
  }, [scale]);

  return (
    <View
      className={`flex-row items-center gap-2.5 rounded-card p-3.5 ${weekComplete ? "bg-success/25" : "bg-success/15"}`}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {weekComplete ? (
          <Text className="text-lg">{milestone ? "🏅" : "🎉"}</Text>
        ) : (
          <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
        )}
      </Animated.View>
      <Text className={`flex-1 text-sm text-text ${weekComplete ? "font-semibold" : ""}`}>
        {text} {t(" Un mot dessus ?")}
      </Text>
      <TouchableOpacity
        onPress={() => {
          onDismiss();
          router.push(`/session-note-modal?sessionId=${session.id}`);
        }}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text className="text-sm font-bold text-success">{t("Écrire")}</Text>
      </TouchableOpacity>
    </View>
  );
}
