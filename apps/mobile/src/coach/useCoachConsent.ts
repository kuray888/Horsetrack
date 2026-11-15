import { useCallback, useEffect, useState } from "react";
import { useCurrentUserId } from "@/lib/currentUser";
import { syncCoachConsent } from "@/coach/coachApi";
import { hasCoachConsent, loadCoachConsent, setCoachConsent, subscribeToCoachConsent } from "@/coach/consent";

/** `granted` est null tant que l'accord n'est pas lu : n'envoyer qu'à `true`. */
export function useCoachConsent(): { granted: boolean | null; grant: () => Promise<void>; revoke: () => Promise<void> } {
  const userId = useCurrentUserId();
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    void loadCoachConsent().then(() => alive && setReady(true));
    const off = subscribeToCoachConsent(() => bump((n) => n + 1));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const grant = useCallback(async () => {
    if (!userId) return;
    await setCoachConsent(userId, true);
    void syncCoachConsent(true);
  }, [userId]);
  const revoke = useCallback(async () => {
    if (!userId) return;
    await setCoachConsent(userId, false);
    void syncCoachConsent(false);
  }, [userId]);

  return { granted: ready && userId ? hasCoachConsent(userId) : null, grant, revoke };
}
