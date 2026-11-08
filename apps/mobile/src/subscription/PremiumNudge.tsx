import { useCallback, useMemo } from "react";
import * as SecureStore from "expo-secure-store";
import { router, useFocusEffect } from "expo-router";
import { withKeyLock } from "@/lib/keyLock";
import { track } from "@/lib/analytics";
import { useAgenda } from "@/agenda/store";
import { useSessions } from "@/sessions/store";
import { useSubscription } from "./store";
import { recordNudgeShown, shouldShowNudge } from "./premiumNudgeLogic";
import { NUDGE_KEY as KEY, readNudgeState as readState } from "./premiumNudgeStore";

/** Laisse l'Accueil s'afficher et se lire avant de proposer quoi que ce soit. */
const DELAY_MS = 1500;

/** Une relance par lancement au plus, même si l'Accueil reprend le focus. */
let shownThisLaunch = false;

/**
 * Relance Premium périodique (règles : ./premiumNudgeLogic.ts), montée sur
 * l'Accueil. N'affiche rien elle-même : ouvre le paywall standard, contexte
 * « reminder », fermable d'un toucher comme partout.
 */
export function PremiumNudge({ horseId }: { horseId: string | null }) {
  const { isActiveOrTrialing, loading } = useSubscription();
  const { sessions } = useSessions();
  const { journal, appointments } = useAgenda();
  const activityCount = useMemo(
    () => sessions.filter((s) => s.completed).length + journal.length + appointments.length,
    [sessions, journal, appointments]
  );

  useFocusEffect(
    useCallback(() => {
      if (loading || isActiveOrTrialing || shownThisLaunch) return;
      let cancelled = false;
      const timer = setTimeout(() => {
        withKeyLock(KEY, async () => {
          const now = new Date();
          const state = readState(await SecureStore.getItemAsync(KEY), now);
          const show = !cancelled && !shownThisLaunch && shouldShowNudge(state, { premium: false, activityCount, now });
          // L'état est écrit même sans relance : la date de première
          // ouverture (délai de 3 jours) part de la première lecture.
          await SecureStore.setItemAsync(KEY, JSON.stringify(show ? recordNudgeShown(state, now) : state));
          return { show, count: state.shownAt.length + 1 };
        })
          .then(({ show, count }) => {
            if (!show || cancelled) return;
            shownThisLaunch = true;
            track("premium_nudge_shown", { nudge_count: count, activity: activityCount });
            router.push({ pathname: "/paywall", params: { from: "reminder", ...(horseId ? { horseId } : {}) } });
          })
          .catch(() => {});
      }, DELAY_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [loading, isActiveOrTrialing, activityCount, horseId])
  );

  return null;
}
