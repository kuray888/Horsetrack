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
import { safeJsonParse } from "@/lib/safeJsonParse";
import { pushHorses } from "@/lib/cloudSync";
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
 * Écurie de l'utilisateur, persistée localement et sauvegardée vers Supabase
 * en best-effort (cf. lib/cloudSync.ts) — accessible depuis tout l'app, pas seulement
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
  /** Ce que fait le cheval les jours sans séance (paddock, longe...) — affiché
   * sur les jours de repos dans Planning/Today. */
  restDayActivities: string[];
  injuries: Injury[];
  /** null = cheval possédé. Renseigné si ce cheval est partagé AVEC
   * l'utilisateur courant (cf. lib/sharing.ts) — pilote le mode lecture seule
   * du profil et l'exclusion du quota de chevaux du palier (cf. profile.tsx,
   * today.tsx). Un cheval partagé n'est jamais retourné par `pushHorses` (cf.
   * cloudSync.ts), seulement par `pullSharedHorses`. */
  sharedRole: "DEMI_PENSION" | "COACH" | null;
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
  restDayActivities: string[];
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
    restDayActivities: ["Paddock / pré", "Marche en main"],
    injuries: [],
    sharedRole: null,
  },
];

/** Active une activité différente selon le jour de la semaine (0 = lundi ...
 * 6 = dimanche) plutôt que d'afficher toute la liste choisie à chaque jour de
 * repos : un cheval qui va au paddock certains jours et reste au box d'autres
 * jours a une routine cohérente — pas un mélange de toutes ses activités à la
 * fois. Avec une seule activité choisie, elle s'applique à tous les jours de
 * repos (comportement inchangé). */
export function restDayActivityFor(horse: Horse, dayOffset: number): string | null {
  if (horse.restDayActivities.length === 0) return null;
  return horse.restDayActivities[dayOffset % horse.restDayActivities.length];
}

function generateId(): string {
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** JSON.parse renvoie les dates de blessures en string — on les remet en Date à
 * la lecture. Comble aussi les champs ajoutés après coup (ex: restDayActivities)
 * absents des chevaux sauvegardés avant leur introduction — sans ça, un cheval
 * créé avant cet ajout charge `undefined` au lieu d'un tableau vide et fait
 * planter tout appel à `.length`/`.join()` dessus (cf. Today/Planning sur un
 * jour de repos). */
function reviveHorses(horses: Horse[]): Horse[] {
  return horses.map((h) => ({
    ...h,
    restDayActivities: h.restDayActivities ?? [],
    sharedRole: h.sharedRole ?? null,
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
    restDayActivities: draft.restDayActivities,
    sharedRole: null,
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
  /** Restaure l'écurie depuis une sauvegarde cloud (cf. lib/cloudSync.ts) —
   * distinct de replaceHorses : prend des Horse déjà complets, pas des
   * brouillons d'onboarding, et ne republie pas vers le cloud. */
  hydrateFromCloud: (horses: Horse[]) => void;
  updateHorsePhoto: (id: string, photoUrl: string) => void;
  /** Retire un cheval possédé de l'écurie (jamais un cheval partagé) — no-op
   * si c'est le dernier cheval possédé : Today/Programme/etc. supposent
   * `selectedHorse` toujours non-null, l'écurie ne doit jamais devenir vide.
   * Réassigne isPrimary/selectedHorse si le cheval supprimé les portait. */
  removeHorse: (id: string) => void;
  /** Cheval actuellement sélectionné (cf. sélecteur sur Today) — pilote la
   * progression/programme affichés ailleurs dans l'app. */
  selectedHorse: Horse | null;
  selectHorse: (id: string) => void;
  /** Efface l'écurie locale (cf. suppression de compte dans Profil) — remet
   * l'état exactement comme à l'installation, pas juste un tableau vide. */
  clearAll: () => Promise<void>;
};

const HorsesContext = createContext<HorsesContextValue | null>(null);

export function HorsesProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [horses, setHorses] = useState<Horse[]>(DEFAULT_HORSES);
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(STORAGE_KEY), SecureStore.getItemAsync(SELECTED_KEY)])
      .then(([rawHorses, rawSelected]) => {
        const loaded: Horse[] = reviveHorses(safeJsonParse(rawHorses, DEFAULT_HORSES));
        setHorses(loaded);
        setSelectedHorseId(rawSelected ?? loaded.find((h) => h.isPrimary)?.id ?? loaded[0]?.id ?? null);
      })
      .catch((e) => console.warn("[horses] lecture SecureStore échouée, écurie par défaut", e))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((next: Horse[]) => {
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    // Best-effort, jamais bloquant : cf. lib/cloudSync.ts. Une régénération de
    // programme/affichage local ne doit jamais attendre le réseau. Exclut les
    // chevaux partagés : on n'en est pas propriétaire, les réécrire serait
    // sans effet (RLS bloque, cf. owns_rider_profile) et inutile.
    pushHorses(next.filter((h) => !h.sharedRole)).catch(() => {});
  }, []);

  const addHorse = useCallback(
    (horse: NewHorse) => {
      setHorses((prev) => {
        const next = [...prev, { ...horse, id: generateId(), emoji: "🐴", isPrimary: false, sharedRole: null }];
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

  const removeHorse = useCallback(
    (id: string) => {
      const target = horses.find((h) => h.id === id);
      if (!target || target.sharedRole) return;
      if (horses.filter((h) => !h.sharedRole).length <= 1) return;

      let next = horses.filter((h) => h.id !== id);
      if (target.isPrimary) {
        const newPrimaryId = next.find((h) => !h.sharedRole)?.id;
        next = next.map((h) => (h.id === newPrimaryId ? { ...h, isPrimary: true } : h));
      }
      setHorses(next);
      persist(next);

      if (selectedHorseId === id) {
        const fallbackId =
          next.find((h) => h.isPrimary)?.id ?? next.find((h) => !h.sharedRole)?.id ?? next[0]?.id ?? null;
        setSelectedHorseId(fallbackId);
        if (fallbackId) SecureStore.setItemAsync(SELECTED_KEY, fallbackId);
      }
    },
    [horses, persist, selectedHorseId]
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

  // Hydrate l'écurie depuis une sauvegarde cloud (cf. lib/cloudSync.ts,
  // appelé par (auth)/login.tsx quand cet appareil n'a pas les données du
  // compte qui vient de se connecter). Persiste localement SANS repousser
  // vers le cloud : on vient justement d'en lire l'état, le republier serait
  // un aller-retour inutile.
  const hydrateFromCloud = useCallback((next: Horse[]) => {
    setHorses(next);
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    const primaryId = next.find((h) => h.isPrimary)?.id ?? next[0]?.id ?? null;
    setSelectedHorseId(primaryId);
    if (primaryId) SecureStore.setItemAsync(SELECTED_KEY, primaryId);
  }, []);

  const selectHorse = useCallback((id: string) => {
    setSelectedHorseId(id);
    SecureStore.setItemAsync(SELECTED_KEY, id);
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all([SecureStore.deleteItemAsync(STORAGE_KEY), SecureStore.deleteItemAsync(SELECTED_KEY)]);
    setHorses(DEFAULT_HORSES);
    setSelectedHorseId(DEFAULT_HORSES.find((h) => h.isPrimary)?.id ?? DEFAULT_HORSES[0]?.id ?? null);
  }, []);

  const selectedHorse = useMemo(
    () => horses.find((h) => h.id === selectedHorseId) ?? horses.find((h) => h.isPrimary) ?? horses[0] ?? null,
    [horses, selectedHorseId]
  );

  const value = useMemo<HorsesContextValue>(
    () => ({
      loading,
      horses,
      addHorse,
      updateHorse,
      replaceHorses,
      hydrateFromCloud,
      updateHorsePhoto,
      removeHorse,
      selectedHorse,
      selectHorse,
      clearAll,
    }),
    [
      loading,
      horses,
      addHorse,
      updateHorse,
      replaceHorses,
      hydrateFromCloud,
      updateHorsePhoto,
      removeHorse,
      selectedHorse,
      selectHorse,
      clearAll,
    ]
  );

  return <HorsesContext.Provider value={value}>{children}</HorsesContext.Provider>;
}

export function useHorses() {
  const ctx = useContext(HorsesContext);
  if (!ctx) throw new Error("useHorses doit être utilisé dans <HorsesProvider>");
  return ctx;
}
