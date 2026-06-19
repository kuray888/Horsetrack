import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import type { Discipline, HorseLevel } from "@/onboarding/store";

/**
 * Écurie de l'utilisateur, persistée localement (en attendant Supabase, cf.
 * onboarding/persist.ts) — accessible depuis tout l'app, pas seulement
 * pendant l'onboarding (dont le store est démonté une fois sorti du groupe
 * de routes (onboarding)).
 */

const STORAGE_KEY = "horses_v1";

export type Horse = {
  id: string;
  name: string;
  emoji: string;
  discipline: Discipline;
  level: HorseLevel;
  isPrimary: boolean;
  strengths: string[];
  weaknesses: string[];
};

export type NewHorse = {
  name: string;
  discipline: Discipline;
  level: HorseLevel;
  strengths: string[];
  weaknesses: string[];
};

const DEFAULT_HORSES: Horse[] = [
  {
    id: "h1",
    name: "Tornado",
    emoji: "🐴",
    discipline: "SHOW_JUMPING",
    level: "CLUB",
    isPrimary: true,
    strengths: ["Saut", "Mental"],
    weaknesses: ["Impulsion"],
  },
];

function generateId(): string {
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type HorsesContextValue = {
  loading: boolean;
  horses: Horse[];
  addHorse: (horse: NewHorse) => void;
};

const HorsesContext = createContext<HorsesContextValue | null>(null);

export function HorsesProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [horses, setHorses] = useState<Horse[]>(DEFAULT_HORSES);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      if (raw) setHorses(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const persist = useCallback((next: Horse[]) => {
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addHorse = useCallback(
    (horse: NewHorse) => {
      setHorses((prev) => {
        const next = [...prev, { ...horse, id: generateId(), emoji: "🐴", isPrimary: false }];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const value = useMemo<HorsesContextValue>(
    () => ({ loading, horses, addHorse }),
    [loading, horses, addHorse]
  );

  return <HorsesContext.Provider value={value}>{children}</HorsesContext.Provider>;
}

export function useHorses() {
  const ctx = useContext(HorsesContext);
  if (!ctx) throw new Error("useHorses doit être utilisé dans <HorsesProvider>");
  return ctx;
}
