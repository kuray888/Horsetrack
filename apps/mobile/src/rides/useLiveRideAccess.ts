import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useSubscription } from "@/subscription/store";
import { countOwnRides, liveRideAccess, type LiveRideAccess } from "@/rides/liveRideAccess";

// Lu une fois par lancement : il ne change que par la migration du serveur.
let cached: { userId: string; value: boolean | null } | null = null;

/** Drapeau « compte d'avant la 1.3.0 ». Null si inconnu (hors ligne, base pas
 * encore migrée, pas de compte) : la séance reste ouverte, comme avant ; le
 * serveur a le dernier mot. */
async function readLiveRideFree(): Promise<boolean | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;
    if (cached?.userId === userId) return cached.value;
    const { data, error } = await supabase.from("rider_profiles").select("liveRideFree").eq("userId", userId).maybeSingle();
    const value = error || !data || typeof data.liveRideFree !== "boolean" ? null : data.liveRideFree;
    if (!error) cached = { userId, value };
    return value;
  } catch {
    return null;
  }
}

/** « loading » le temps de lire le drapeau (quelques dixièmes de seconde). */
export function useLiveRideAccess(): LiveRideAccess | "loading" {
  const { isActiveOrTrialing } = useSubscription();
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const [flag, setFlag] = useState<boolean | null | undefined>(undefined);

  useEffect(() => {
    if (isActiveOrTrialing) return;
    let cancelled = false;
    readLiveRideFree().then((v) => {
      if (!cancelled) setFlag(v);
    });
    return () => {
      cancelled = true;
    };
  }, [isActiveOrTrialing]);

  if (isActiveOrTrialing) return "allowed";
  if (flag === undefined) return "loading";
  const owned = new Set(horses.filter((h) => !h.sharedRole).map((h) => h.id));
  return liveRideAccess({ isPremium: false, liveRideFree: flag, ownRides: countOwnRides(sessions, owned) });
}
