import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency } from "@/onboarding/store";

/**
 * Profil cavalier, persisté localement (en attendant Supabase, cf.
 * onboarding/persist.ts) — pendant de horses/store.tsx pour le cavalier :
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
  additionalInfo: string;
};

const DEFAULT_RIDER_PROFILE: RiderProfile = {
  level: null,
  mainDiscipline: null,
  rideFrequency: null,
  primaryGoal: null,
  additionalInfo: "",
};

type RiderProfileContextValue = {
  loading: boolean;
  riderProfile: RiderProfile;
  setRiderProfile: (profile: RiderProfile) => void;
};

const RiderProfileContext = createContext<RiderProfileContextValue | null>(null);

export function RiderProfileProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [riderProfile, setRiderProfileState] = useState<RiderProfile>(DEFAULT_RIDER_PROFILE);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      setRiderProfileState(raw ? JSON.parse(raw) : DEFAULT_RIDER_PROFILE);
      setLoading(false);
    });
  }, []);

  const setRiderProfile = useCallback((profile: RiderProfile) => {
    setRiderProfileState(profile);
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profile));
  }, []);

  const value = useMemo<RiderProfileContextValue>(
    () => ({ loading, riderProfile, setRiderProfile }),
    [loading, riderProfile, setRiderProfile]
  );

  return <RiderProfileContext.Provider value={value}>{children}</RiderProfileContext.Provider>;
}

export function useRiderProfile() {
  const ctx = useContext(RiderProfileContext);
  if (!ctx) throw new Error("useRiderProfile doit être utilisé dans <RiderProfileProvider>");
  return ctx;
}
