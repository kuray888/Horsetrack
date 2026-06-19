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
const SELECTED_KEY = "selected_horse_id_v1";

/** Id du cheval pré-rempli au premier lancement — utilisé par progress/store.tsx
 * pour décider quel cheval reçoit les séances passées pré-cochées (démo). */
export const SEED_HORSE_ID = "h1";

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
  /** Cheval actuellement sélectionné (cf. sélecteur sur Today) — pilote la
   * progression/programme affichés ailleurs dans l'app. */
  selectedHorse: Horse | null;
  selectHorse: (id: string) => void;
};

const HorsesContext = createContext<HorsesContextValue | null>(null);

export function HorsesProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [horses, setHorses] = useState<Horse[]>(DEFAULT_HORSES);
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(STORAGE_KEY), SecureStore.getItemAsync(SELECTED_KEY)]).then(
      ([rawHorses, rawSelected]) => {
        const loaded: Horse[] = rawHorses ? JSON.parse(rawHorses) : DEFAULT_HORSES;
        setHorses(loaded);
        setSelectedHorseId(rawSelected ?? loaded.find((h) => h.isPrimary)?.id ?? loaded[0]?.id ?? null);
        setLoading(false);
      }
    );
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

  const selectHorse = useCallback((id: string) => {
    setSelectedHorseId(id);
    SecureStore.setItemAsync(SELECTED_KEY, id);
  }, []);

  const selectedHorse = useMemo(
    () => horses.find((h) => h.id === selectedHorseId) ?? horses.find((h) => h.isPrimary) ?? horses[0] ?? null,
    [horses, selectedHorseId]
  );

  const value = useMemo<HorsesContextValue>(
    () => ({ loading, horses, addHorse, selectedHorse, selectHorse }),
    [loading, horses, addHorse, selectedHorse, selectHorse]
  );

  return <HorsesContext.Provider value={value}>{children}</HorsesContext.Provider>;
}

export function useHorses() {
  const ctx = useContext(HorsesContext);
  if (!ctx) throw new Error("useHorses doit être utilisé dans <HorsesProvider>");
  return ctx;
}
