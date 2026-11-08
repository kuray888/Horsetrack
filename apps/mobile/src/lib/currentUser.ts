import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Identifiant du compte connecté, lu dans la session locale (sans réseau,
 * donc aussi hors ligne) et suivi aux connexions / déconnexions. Null tant
 * que la session n'est pas lue, ou sans compte.
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setUserId(data.session?.user.id ?? null);
      })
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return userId;
}
