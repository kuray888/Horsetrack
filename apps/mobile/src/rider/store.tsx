import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { pushRiderProfile } from "@/lib/cloudSync";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency } from "@/onboarding/store";

/**
 * Profil cavalier, persisté localement et sauvegardé vers Supabase en
 * best-effort (cf. lib/cloudSync.ts) — pendant de horses/store.tsx pour le cavalier :
 * sans ce store, les réponses d'onboarding (niveau, discipline, objectif...)
 * n'auraient jamais existé ailleurs que dans le contexte d'onboarding, démonté
 * une fois l'utilisateur sorti du groupe de routes (onboarding).
 */

const STORAGE_KEY = "rider_profile_v1";

export type RiderProfile = {
  level: RiderLevel | null;
  mainDiscipline: Discipline | null;
  rideFrequency: RideFrequency | null;
  primaryGoal: RiderGoal | null;
  /** Libellé libre quand `primaryGoal` ne couvre pas le besoin (cf. sélection
   * "Autre" dans edit-rider-modal.tsx) — même pattern que Goal.customType,
   * toujours null quand `primaryGoal` porte une valeur de l'enum RiderGoal.
   * Colonne `primaryGoalCustom` dédiée côté Supabase (text, nullable, cf.
   * schema.prisma), synchronisée dans lib/cloudSync.ts. */
  primaryGoalCustom: string | null;
};

const DEFAULT_RIDER_PROFILE: RiderProfile = {
  level: null,
  mainDiscipline: null,
  rideFrequency: null,
  primaryGoal: null,
  primaryGoalCustom: null,
};

type RiderProfileContextValue = {
  loading: boolean;
  riderProfile: RiderProfile;
  setRiderProfile: (profile: RiderProfile) => void;
  /** Efface le profil local (cf. suppression de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const RiderProfileContext = createContext<RiderProfileContextValue | null>(null);

export function RiderProfileProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [riderProfile, setRiderProfileState] = useState<RiderProfile>(DEFAULT_RIDER_PROFILE);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        const parsed = safeJsonParse(raw, DEFAULT_RIDER_PROFILE);
        // Profil sauvegardé avant l'introduction de primaryGoalCustom — même
        // souci déjà rencontré sur Horse.restDayActivities/Goal.customType.
        setRiderProfileState({ ...parsed, primaryGoalCustom: parsed.primaryGoalCustom ?? null });
      })
      .catch((e) => console.warn("[rider] lecture SecureStore échouée, profil par défaut", e))
      .finally(() => setLoading(false));
  }, []);

  const setRiderProfile = useCallback((profile: RiderProfile) => {
    setRiderProfileState(profile);
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profile));
    // Best-effort, jamais bloquant : cf. lib/cloudSync.ts.
    pushRiderProfile(profile).catch(() => {});
  }, []);

  const clearAll = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setRiderProfileState(DEFAULT_RIDER_PROFILE);
  }, []);

  const value = useMemo<RiderProfileContextValue>(
    () => ({ loading, riderProfile, setRiderProfile, clearAll }),
    [loading, riderProfile, setRiderProfile, clearAll]
  );

  return <RiderProfileContext.Provider value={value}>{children}</RiderProfileContext.Provider>;
}

export function useRiderProfile() {
  const ctx = useContext(RiderProfileContext);
  if (!ctx) throw new Error("useRiderProfile doit être utilisé dans <RiderProfileProvider>");
  return ctx;
}
