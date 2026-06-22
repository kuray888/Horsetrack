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
import type {
  Discipline,
  HorseDraft,
  HorseFitnessLevel,
  HorseLevel,
  HorseRecoveryStatus,
  HorseSex,
  HorseWorkload,
} from "@/onboarding/store";

/**
 * Écurie de l'utilisateur, persistée localement (en attendant Supabase, cf.
 * onboarding/persist.ts) — accessible depuis tout l'app, pas seulement
 * pendant l'onboarding (dont le store est démonté une fois sorti du groupe
 * de routes (onboarding)).
 */

const STORAGE_KEY = "horses_v1";
const SELECTED_KEY = "selected_horse_id_v1";

export type Injury = {
  id: string;
  type: string;
  occurredAt: Date | null;
  recoveryStatus: HorseRecoveryStatus | null;
  note: string;
};

export type Horse = {
  id: string;
  name: string;
  emoji: string;
  /** URI locale de la photo (copiée dans le stockage persistant de l'app via
   * lib/imagePicker.ts) — null tant qu'aucune photo n'a été ajoutée. */
  photoUrl: string | null;
  birthYear: number | null;
  sex: HorseSex | null;
  breed: string | null;
  heightCm: number | null;
  weightKg: number | null;
  discipline: Discipline;
  level: HorseLevel;
  fitnessLevel: HorseFitnessLevel | null;
  workload: HorseWorkload | null;
  isPrimary: boolean;
  strengths: string[];
  weaknesses: string[];
  temperament: string[];
  healthConditions: string[];
  injuries: Injury[];
};

export type NewHorse = {
  name: string;
  photoUrl: string | null;
  birthYear: number | null;
  sex: HorseSex | null;
  breed: string | null;
  heightCm: number | null;
  weightKg: number | null;
  discipline: Discipline;
  level: HorseLevel;
  fitnessLevel: HorseFitnessLevel | null;
  workload: HorseWorkload | null;
  strengths: string[];
  weaknesses: string[];
  temperament: string[];
  healthConditions: string[];
  injuries: Injury[];
};

const DEFAULT_HORSES: Horse[] = [
  {
    id: "h1",
    name: "Tornado",
    emoji: "🐴",
    photoUrl: null,
    birthYear: new Date().getFullYear() - 9,
    sex: "GELDING",
    breed: "Selle Français",
    heightCm: 165,
    weightKg: 550,
    discipline: "SHOW_JUMPING",
    level: "CLUB",
    fitnessLevel: "GOOD",
    workload: "THREE_TO_FOUR",
    isPrimary: true,
    strengths: ["Saut", "Mental"],
    weaknesses: ["Impulsion"],
    temperament: ["Calme", "Joueur"],
    healthConditions: [],
    injuries: [],
  },
];

function generateId(): string {
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** JSON.parse renvoie les dates de blessures en string — on les remet en Date à la lecture. */
function reviveHorses(horses: Horse[]): Horse[] {
  return horses.map((h) => ({
    ...h,
    injuries: h.injuries.map((i) => ({
      ...i,
      occurredAt: i.occurredAt ? new Date(i.occurredAt) : null,
    })),
  }));
}

/** Cheval avec discipline/niveau garantis non-null — horse-profile.tsx bloque
 * la suite de l'onboarding tant qu'ils ne sont pas renseignés. */
type CompletedHorseDraft = HorseDraft & { discipline: Discipline; level: HorseLevel };

function fromDraft(draft: CompletedHorseDraft): Horse {
  return {
    id: generateId(),
    name: draft.name.trim(),
    emoji: "🐴",
    photoUrl: draft.photoUrl,
    birthYear: draft.birthYear,
    sex: draft.sex,
    breed: draft.breed,
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    discipline: draft.discipline,
    level: draft.level,
    fitnessLevel: draft.fitnessLevel,
    workload: draft.workload,
    isPrimary: draft.isPrimary,
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    temperament: draft.temperament,
    healthConditions: draft.healthConditions,
    injuries: draft.injuries.map((i) => ({
      id: generateId(),
      type: i.type,
      occurredAt: i.occurredAt,
      recoveryStatus: i.recoveryStatus,
      note: i.note,
    })),
  };
}

type HorsesContextValue = {
  loading: boolean;
  horses: Horse[];
  addHorse: (horse: NewHorse) => void;
  updateHorse: (id: string, horse: NewHorse) => void;
  /** Remplace toute l'écurie par les chevaux de l'onboarding — appelé une
   * seule fois à la fin du parcours (cf. (onboarding)/paywall.tsx). */
  replaceHorses: (drafts: HorseDraft[]) => void;
  updateHorsePhoto: (id: string, photoUrl: string) => void;
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
        const loaded: Horse[] = rawHorses ? reviveHorses(JSON.parse(rawHorses)) : DEFAULT_HORSES;
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

  const updateHorse = useCallback(
    (id: string, horse: NewHorse) => {
      setHorses((prev) => {
        const next = prev.map((h) => (h.id === id ? { ...h, ...horse } : h));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const replaceHorses = useCallback(
    (drafts: HorseDraft[]) => {
      const completed = drafts.filter(
        (d): d is CompletedHorseDraft => d.name.trim().length > 0 && d.discipline !== null && d.level !== null
      );
      const next = completed.map(fromDraft);
      if (next.length > 0 && !next.some((h) => h.isPrimary)) next[0].isPrimary = true;

      setHorses(next);
      persist(next);

      const primaryId = next.find((h) => h.isPrimary)?.id ?? next[0]?.id ?? null;
      setSelectedHorseId(primaryId);
      if (primaryId) SecureStore.setItemAsync(SELECTED_KEY, primaryId);
    },
    [persist]
  );

  const updateHorsePhoto = useCallback(
    (id: string, photoUrl: string) => {
      setHorses((prev) => {
        const next = prev.map((h) => (h.id === id ? { ...h, photoUrl } : h));
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
    () => ({ loading, horses, addHorse, updateHorse, replaceHorses, updateHorsePhoto, selectedHorse, selectHorse }),
    [loading, horses, addHorse, updateHorse, replaceHorses, updateHorsePhoto, selectedHorse, selectHorse]
  );

  return <HorsesContext.Provider value={value}>{children}</HorsesContext.Provider>;
}

export function useHorses() {
  const ctx = useContext(HorsesContext);
  if (!ctx) throw new Error("useHorses doit être utilisé dans <HorsesProvider>");
  return ctx;
}
