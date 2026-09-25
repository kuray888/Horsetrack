import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSessions, type TrainingSession } from "@/sessions/store";

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
    const timer = setTimeout(() => setPrompted(null), PROMPT_MS);
    return () => clearTimeout(timer);
  }, [prompted]);

  /** À appeler à la place de `toggleCompleted` partout où une séance se coche. */
  function toggleSessionDone(session: TrainingSession) {
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
  const colors = useThemeColors();
  if (!session) return null;
  return (
    <View className="flex-row items-center gap-2.5 rounded-card bg-success/15 p-3.5">
      <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} />
      <Text className="flex-1 text-sm text-text">Séance faite. Un mot dessus ?</Text>
      <TouchableOpacity
        onPress={() => {
          onDismiss();
          router.push(`/session-note-modal?sessionId=${session.id}`);
        }}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text className="text-sm font-bold text-success">Écrire</Text>
      </TouchableOpacity>
    </View>
  );
}
