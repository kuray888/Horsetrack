import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from "react";
import { readJsonChecked, writeJson } from "@/lib/localStore";
import { DRAFT_KEY, reviveDraft } from "./draftPersistence";

/**
 * Store d'onboarding (React Context, pas de dépendance externe).
 *
 * Les valeurs des champs typés (level, discipline, sex…) sont les MÊMES chaînes
 * que les enums Prisma (`packages/db/prisma/schema.prisma`) afin que la
 * persistance Supabase en fin de parcours soit un mapping direct, sans traduction.
 *
 * Multi-cheval natif : `horses` est un tableau ; on édite le cheval courant via
 * `editingIndex`. L'utilisateur peut en ajouter autant qu'il veut (illimité).
 */

// ─── Enums (alignés Prisma) ───
export type RiderLevel = "BEGINNER" | "GALOP_1_4" | "GALOP_5_7" | "AMATEUR" | "PRO";
export type RideFrequency = "DAILY" | "SEVERAL_PER_WEEK" | "WEEKEND" | "OCCASIONAL";
export type Discipline =
  | "SHOW_JUMPING"
  | "HUNTER"
  | "DRESSAGE"
  | "EVENTING"
  | "WESTERN"
  | "ENDURANCE"
  | "ATTELAGE"
  | "LEISURE"
  | "ETHOLOGY";
export type RiderGoal = "COMPETE" | "BONDING" | "FITNESS" | "EVENT_PREP" | "CONFIDENCE";
export type HorseSex = "GELDING" | "MARE" | "STALLION";
export type HorseLevel = "UNTRAINED" | "CLUB" | "AMATEUR" | "PRO";
export type HorseFitnessLevel = "RESTING" | "REOPENING" | "GOOD" | "PEAK";
export type HorseWorkload = "NONE" | "ONE_TO_TWO" | "THREE_TO_FOUR" | "FIVE_TO_SIX" | "DAILY";
export type HorseRecoveryStatus = "RECOVERED" | "IN_PROGRESS" | "ONGOING";

export type InjuryDraft = {
  /** id local le temps de l'onboarding, remplacé en base */
  localId: string;
  type: string;
  occurredAt: Date | null;
  recoveryStatus: HorseRecoveryStatus | null;
  note: string;
};

export type HorseDraft = {
  /** id local (uuid temporaire) le temps de l'onboarding, remplacé en base */
  localId: string;
  name: string;
  photoUrl: string | null;
  birthYear: number | null;
  sex: HorseSex | null;
  breed: string | null;
  coat: string | null;
  heightCm: number | null;
  weightKg: number | null;
  discipline: Discipline | null;
  level: HorseLevel | null;
  fitnessLevel: HorseFitnessLevel | null;
  workload: HorseWorkload | null;
  strengths: string[];
  weaknesses: string[];
  temperament: string[];
  healthConditions: string[];
  /** Ce que fait le cheval les jours sans séance (paddock, longe...) — affiché
   * sur les jours de repos dans Planning/Today (cf. onboarding/options.ts). */
  restDayActivities: string[];
  injuries: InjuryDraft[];
  isPrimary: boolean;
};

export type RiderDraft = {
  level: RiderLevel | null;
  mainDiscipline: Discipline | null;
  rideFrequency: RideFrequency | null;
  primaryGoal: RiderGoal | null;
};

/** Parcours choisi sur l'écran de bienvenue : « owner » (j'ai un cheval :
 * le cheval d'abord, le compte à la fin) ou « invited » (on m'a invité·e
 * sur le cheval de quelqu'un : le compte d'abord, pour accepter le partage
 * sans inventer de cheval). null : pas encore choisi. */
export type OnboardingFlow = "owner" | "invited";

type OnboardingState = {
  rider: RiderDraft;
  horses: HorseDraft[];
  editingIndex: number;
  flow: OnboardingFlow | null;
};

/** Délai avant d'écrire le brouillon : regroupe les frappes d'un nom. */
const SAVE_DELAY_MS = 400;

export function newHorse(isPrimary: boolean): HorseDraft {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    photoUrl: null,
    birthYear: null,
    sex: null,
    breed: null,
    coat: null,
    heightCm: null,
    weightKg: null,
    discipline: null,
    level: null,
    fitnessLevel: null,
    workload: null,
    strengths: [],
    weaknesses: [],
    temperament: [],
    healthConditions: [],
    restDayActivities: [],
    injuries: [],
    isPrimary,
  };
}

type OnboardingContextValue = OnboardingState & {
  setRider: (patch: Partial<RiderDraft>) => void;
  setFlow: (flow: OnboardingFlow) => void;
  /** Vrai une fois le brouillon sauvegardé relu (ou absent). */
  hydrated: boolean;
  /** Cheval en cours d'édition (toujours défini pendant les écrans cheval). */
  editingHorse: HorseDraft;
  updateEditingHorse: (patch: Partial<HorseDraft>) => void;
  /** Démarre un nouveau cheval vierge et le sélectionne pour édition. */
  startNewHorse: () => void;
  /** Sélectionne un cheval existant pour le rééditer. */
  editHorse: (index: number) => void;
  removeHorse: (localId: string) => void;
  /** Ajoute une blessure à l'historique du cheval en cours d'édition. */
  addInjury: (injury: Omit<InjuryDraft, "localId">) => void;
  removeInjury: (localId: string) => void;
  reset: () => void;
};

const initialState: OnboardingState = {
  rider: {
    level: null,
    mainDiscipline: null,
    rideFrequency: null,
    primaryGoal: null,
  },
  horses: [newHorse(true)],
  editingIndex: 0,
  flow: null,
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  // Une saisie commencée avant la fin de la relecture n'est jamais écrasée
  // par le brouillon relu.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    readJsonChecked<unknown>(DRAFT_KEY, null)
      .then(({ value }) => {
        if (cancelled) return;
        const draft = reviveDraft(value, newHorse);
        if (draft && !touched.current) setState(draft);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sauvegarde du brouillon (cf. onboarding/draftPersistence.ts), après la
  // relecture seulement : avant, on écraserait le brouillon par l'état vierge.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => void writeJson(DRAFT_KEY, state), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, hydrated]);

  const setRider = useCallback((patch: Partial<RiderDraft>) => {
    touched.current = true;
    setState((s) => ({ ...s, rider: { ...s.rider, ...patch } }));
  }, []);

  const setFlow = useCallback((flow: OnboardingFlow) => {
    touched.current = true;
    setState((s) => ({ ...s, flow }));
  }, []);

  const updateEditingHorse = useCallback((patch: Partial<HorseDraft>) => {
    touched.current = true;
    setState((s) => {
      const horses = s.horses.slice();
      horses[s.editingIndex] = { ...horses[s.editingIndex], ...patch };
      return { ...s, horses };
    });
  }, []);

  const startNewHorse = useCallback(() => {
    setState((s) => {
      const horses = [...s.horses, newHorse(false)];
      return { ...s, horses, editingIndex: horses.length - 1 };
    });
  }, []);

  const editHorse = useCallback((index: number) => {
    setState((s) => ({ ...s, editingIndex: index }));
  }, []);

  const removeHorse = useCallback((localId: string) => {
    setState((s) => {
      const horses = s.horses.filter((h) => h.localId !== localId);
      // garantit qu'il reste toujours un cheval primaire
      if (horses.length > 0 && !horses.some((h) => h.isPrimary)) horses[0].isPrimary = true;
      // Le seul appelant actuel (horses.tsx) empêche déjà de vider le tableau,
      // mais editingHorse (state.horses[editingIndex]) doit rester défini même
      // si un futur appelant ne garde pas cette garde — cf. audit du 2026-09-08.
      return { ...s, horses, editingIndex: Math.max(0, Math.min(s.editingIndex, horses.length - 1)) };
    });
  }, []);

  const addInjury = useCallback((injury: Omit<InjuryDraft, "localId">) => {
    setState((s) => {
      const horses = s.horses.slice();
      const horse = horses[s.editingIndex];
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      horses[s.editingIndex] = { ...horse, injuries: [...horse.injuries, { ...injury, localId }] };
      return { ...s, horses };
    });
  }, []);

  const removeInjury = useCallback((localId: string) => {
    setState((s) => {
      const horses = s.horses.slice();
      const horse = horses[s.editingIndex];
      horses[s.editingIndex] = { ...horse, injuries: horse.injuries.filter((i) => i.localId !== localId) };
      return { ...s, horses };
    });
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      editingHorse: state.horses[state.editingIndex],
      hydrated,
      setRider,
      setFlow,
      updateEditingHorse,
      startNewHorse,
      editHorse,
      removeHorse,
      addInjury,
      removeInjury,
      reset,
    }),
    [state, hydrated, setRider, setFlow, updateEditingHorse, startNewHorse, editHorse, removeHorse, addInjury, removeInjury, reset]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding doit être utilisé dans <OnboardingProvider>");
  return ctx;
}
