import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { deleteHorsePhotoRemote, pushHorses } from "@/lib/cloudSync";
import { resolveLocalFileUri } from "@/lib/imagePicker";
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
  /** URI à afficher immédiatement : URI locale fraîchement choisie (via
   * lib/imagePicker.ts, pas encore uploadée) OU URL signée régénérée au pull
   * (cf. cloudSync.ts mapRemoteHorse) — jamais persistée telle quelle en base,
   * cf. photoPath. Null tant qu'aucune photo n'a été ajoutée. */
  photoUrl: string | null;
  /** Chemin durable dans le bucket Storage "horse-photos", géré exclusivement
   * par la synchro (cf. cloudSync.ts pushHorses/mapRemoteHorse) — jamais
   * modifié directement par le formulaire. Sert à savoir si une photo a déjà
   * été envoyée dans le cloud, indépendamment de la valeur locale de photoUrl. */
  photoPath: string | null;
  birthYear: number | null;
  sex: HorseSex | null;
  breed: string | null;
  coat: string | null;
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
  sharedRole: "DEMI_PENSION" | "COACH" | "RIDER" | "GROOM" | null;
};

export type NewHorse = {
  name: string;
  photoUrl: string | null;
  birthYear: number | null;
  sex: HorseSex | null;
  breed: string | null;
  coat: string | null;
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

// Aucune donnée de démonstration (cf. même choix déjà fait sur
// agenda/store.tsx, audit produit du 2026-09-03) : un cheval fictif ("Tornado")
// ici s'affichait brièvement sur Today/Chevaux/Horse Hub à chaque lancement
// froid, le temps que la vraie lecture SecureStore résolve — indiscernable
// d'une vraie écurie pour l'utilisateur (cf. audit du 2026-09-09).
const DEFAULT_HORSES: Horse[] = [];

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
    // Chevaux sauvegardés localement avant l'introduction de photoPath
    // (2026-09-04) : jamais uploadée, photoUrl reste une URI locale valide sur
    // cet appareil (cf. lib/imagePicker.ts, stockage persistant) — rien à
    // migrer, juste combler le champ pour ne pas planter le typage.
    photoPath: h.photoPath ?? null,
    // Reconstruit contre le dossier documents actuel (cf. lib/imagePicker.ts
    // resolveLocalFileUri) — sans ça, une photo locale jamais uploadée
    // disparaissait après chaque mise à jour/réinstallation de l'app (cf.
    // audit du 2026-09-09).
    photoUrl: resolveLocalFileUri(h.photoUrl),
    coat: h.coat ?? null,
    injuries: h.injuries.map((i) => ({
      ...i,
      occurredAt: i.occurredAt ? new Date(i.occurredAt) : null,
    })),
  }));
}

/** Cheval avec discipline/niveau garantis non-null — l'onboarding ne demande
 * plus ces champs pour un nouveau cheval (cf. onboarding/options.ts), donc
 * (onboarding)/paywall.tsx les remplit par défaut depuis les réponses du
 * cavalier avant d'appeler replaceHorses ci-dessous. */
type CompletedHorseDraft = HorseDraft & { discipline: Discipline; level: HorseLevel };

function fromDraft(draft: CompletedHorseDraft): Horse {
  return {
    id: generateId(),
    name: draft.name.trim(),
    emoji: "🐴",
    photoUrl: draft.photoUrl,
    // Jamais encore envoyée dans le cloud à ce stade — persist()/pushHorses()
    // s'en charge dès la première synchro (cf. plus bas).
    photoPath: null,
    birthYear: draft.birthYear,
    sex: draft.sex,
    breed: draft.breed,
    coat: draft.coat,
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
  /** Ne modifie que les antécédents de santé d'un cheval POSSÉDÉ (conditions
   * et/ou blessures) — pour l'écran Santé, qui ne doit jamais réécrire le
   * reste de la fiche avec les valeurs qu'il avait au moment de son rendu.
   * No-op pour un cheval partagé (lecture seule, cf. Horse.sharedRole). */
  updateHorseHealth: (id: string, patch: Partial<Pick<Horse, "healthConditions" | "injuries">>) => void;
  /** Remplace toute l'écurie par les chevaux de l'onboarding — appelé une
   * seule fois à la fin du parcours (cf. (onboarding)/paywall.tsx). */
  replaceHorses: (drafts: HorseDraft[]) => void;
  /** Restaure l'écurie depuis une sauvegarde cloud (cf. lib/cloudSync.ts) —
   * distinct de replaceHorses : prend des Horse déjà complets, pas des
   * brouillons d'onboarding, et ne republie pas vers le cloud. */
  hydrateFromCloud: (horses: Horse[]) => void;
  updateHorsePhoto: (id: string, photoUrl: string) => void;
  /** Retire un cheval possédé de l'écurie (jamais un cheval partagé) — no-op
   * si c'est le dernier cheval possédé : Today/Horse Hub/etc. supposent
   * `selectedHorse` toujours non-null, l'écurie ne doit jamais devenir vide.
   * Réassigne isPrimary/selectedHorse si le cheval supprimé les portait. */
  removeHorse: (id: string) => void;
  /** Cheval actuellement sélectionné (cf. sélecteur sur Today) — pilote les
   * séances/rendez-vous/journal affichés ailleurs dans l'app. */
  selectedHorse: Horse | null;
  selectHorse: (id: string) => void;
  /** Efface l'écurie locale (cf. suppression de compte dans Profil) — remet
   * l'état exactement comme à l'installation, pas juste un tableau vide. */
  clearAll: () => Promise<void>;
  /** true si la dernière tentative de synchro a rencontré une vraie erreur
   * réseau/serveur (pas le quota du palier gratuit) — cf. audit du
   * 2026-09-16. Purement indicatif, ne bloque jamais l'usage de l'app. */
  syncFailed: boolean;
  /** Retente la synchro de l'écurie actuelle (cf. tirer-pour-rafraîchir sur
   * l'onglet Chevaux) — mêmes garanties best-effort que persist(), la
   * promesse se résout une fois la tentative terminée (jamais rejetée),
   * pour piloter un indicateur de chargement. */
  retrySync: () => Promise<void>;
};

const HorsesContext = createContext<HorsesContextValue | null>(null);

export function HorsesProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [horses, setHorses] = useState<Horse[]>(DEFAULT_HORSES);
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  // État volatile (jamais persisté) : reflète uniquement la dernière
  // tentative de synchro, pas un historique — cf. audit du 2026-09-16, cette
  // information n'existait nulle part avant (échecs seulement en
  // console.warn). Ne bloque jamais rien, sert uniquement à afficher un
  // indicateur "non synchronisé" quand une vraie erreur réseau/serveur
  // survient (pas le quota du palier gratuit, qui a son propre traitement).
  const [syncFailed, setSyncFailed] = useState(false);
  // Ref et non state : lu au moment exact du push suivant (pas de closure
  // périmée) et ne doit déclencher aucun rendu — cf. son usage dans persist().
  const needsFullSyncRef = useRef(false);

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

  const persist = useCallback(
    // Le retour (résolu une fois la synchro tentée, jamais rejeté) sert
    // uniquement à retrySync() ci-dessous, pour piloter le spinner du
    // tirer-pour-rafraîchir — tous les appels existants l'ignorent déjà
    // (fire-and-forget), cf. commentaire "best-effort" juste en dessous.
    //
    // `changedIds` (cf. cloudSync.ts pushHorses `onlyIds`) : restreint
    // l'upsert au(x) cheval(aux) réellement modifié(s) — omis, TOUS les
    // chevaux fournis sont republiés. Cf. audit du 2026-09-16 : sans ça,
    // renommer un cheval d'une écurie de 5 déclenchait 5 upserts + une
    // lecture de nettoyage à chaque frappe. Ne PAS passer `changedIds` quand
    // l'écurie elle-même change de composition (ajout/suppression/remplacement) :
    // le nettoyage des chevaux obsolètes côté serveur ne tourne alors plus
    // (cf. pushHorses), il faut le push global pour rester correct.
    (next: Horse[], changedIds?: string[]) => {
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      // Rattrapage : tant qu'un push précédent n'a pas abouti (erreur réseau,
      // ou profil serveur pas encore créé), on ignore `changedIds` et on
      // republie TOUT. Sans ça, le cheval resté non synchronisé ne serait
      // jamais retenté : avant l'introduction du push ciblé, chaque
      // modification republiait l'écurie entière et rattrapait donc
      // implicitement les échecs précédents — ce filet avait disparu avec
      // l'optimisation (cf. audit du 2026-09-17).
      const catchUp = needsFullSyncRef.current;
      // Best-effort, jamais bloquant : cf. lib/cloudSync.ts. Une régénération de
      // programme/affichage local ne doit jamais attendre le réseau. Exclut les
      // chevaux partagés : on n'en est pas propriétaire, les réécrire serait
      // sans effet (RLS bloque, cf. owns_rider_profile) et inutile.
      return pushHorses(next.filter((h) => !h.sharedRole), catchUp ? undefined : changedIds)
        .then(({ photoUpdates, rejectedIds, hadUnexpectedError, skipped }) => {
          // Invariant : `needsFullSyncRef` faux ⟺ tout était synchronisé au
          // dernier push. Un push ciblé qui réussit alors que le drapeau
          // était déjà faux suffit donc à affirmer que plus rien n'est en
          // attente. `skipped` n'est pas une erreur à afficher (cas normal
          // pendant l'onboarding) mais laisse bien l'écurie à resynchroniser.
          needsFullSyncRef.current = hadUnexpectedError || skipped;
          setSyncFailed(hadUnexpectedError);
          if (photoUpdates.length === 0 && rejectedIds.length === 0) return;
          setHorses((prev) => {
            // Reporte le photoPath résultant d'un upload/suppression de photo
            // (cf. cloudSync.ts pushHorses) dans l'état local — sans ça, une photo
            // tout juste uploadée resterait marquée "pas encore envoyée" jusqu'à
            // la prochaine synchro et serait ré-uploadée inutilement.
            let merged = prev.map((h) => {
              const update = photoUpdates.find((u) => u.id === h.id);
              return update ? { ...h, photoPath: update.photoPath } : h;
            });
            if (rejectedIds.length > 0) {
              // Cheval refusé par le trigger enforce_horse_quota (palier
              // gratuit déjà à sa limite, cf. cloudSync.ts pushHorses) : il
              // n'a jamais existé côté serveur et n'existera jamais tant que
              // le compte reste sur ce palier. Le garder en local le rendrait
              // fantôme pour toujours, cf. audit du 2026-09-16 — on le retire
              // ici plutôt que via removeHorse() : ce n'est pas une
              // suppression demandée par l'utilisateur, donc son garde-fou
              // "au moins un cheval possédé" ne s'applique pas.
              merged = merged.filter((h) => !rejectedIds.includes(h.id));
              if (merged.length > 0 && !merged.some((h) => h.isPrimary)) {
                const fallbackId = merged.find((h) => !h.sharedRole)?.id;
                merged = merged.map((h) => (h.id === fallbackId ? { ...h, isPrimary: true } : h));
              }
              if (rejectedIds.includes(selectedHorseId ?? "")) {
                const fallbackId =
                  merged.find((h) => h.isPrimary)?.id ?? merged.find((h) => !h.sharedRole)?.id ?? merged[0]?.id ?? null;
                setSelectedHorseId(fallbackId);
                if (fallbackId) SecureStore.setItemAsync(SELECTED_KEY, fallbackId).catch(() => {});
              }
            }
            SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
            return merged;
          });
        })
        .catch(() => {
          needsFullSyncRef.current = true;
          setSyncFailed(true);
        });
    },
    [selectedHorseId]
  );

  const addHorse = useCallback(
    (horse: NewHorse) => {
      const id = generateId();
      setHorses((prev) => {
        const next = [...prev, { ...horse, id, emoji: "🐴", photoPath: null, isPrimary: false, sharedRole: null }];
        // Seul ce nouveau cheval a besoin d'être upserté (cf. cloudSync.ts
        // pushHorses `onlyIds`) — les autres n'ont pas changé.
        persist(next, [id]);
        return next;
      });
    },
    [persist]
  );

  const updateHorse = useCallback(
    (id: string, horse: NewHorse) => {
      setHorses((prev) => {
        const next = prev.map((h) => (h.id === id ? { ...h, ...horse } : h));
        persist(next, [id]);
        return next;
      });
    },
    [persist]
  );

  const updateHorseHealth = useCallback(
    (id: string, patch: Partial<Pick<Horse, "healthConditions" | "injuries">>) => {
      setHorses((prev) => {
        const target = prev.find((h) => h.id === id);
        if (!target || target.sharedRole) return prev;
        const next = prev.map((h) => (h.id === id ? { ...h, ...patch } : h));
        persist(next, [id]);
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
      if (primaryId) SecureStore.setItemAsync(SELECTED_KEY, primaryId).catch(() => {});
    },
    [persist]
  );

  const removeHorse = useCallback(
    (id: string) => {
      const target = horses.find((h) => h.id === id);
      if (!target || target.sharedRole) return;
      if (horses.filter((h) => !h.sharedRole).length <= 1) return;

      // Best-effort : le storage n'a pas de cascade FK depuis `horses`
      // (contrairement aux tables Postgres), donc pas nettoyé automatiquement
      // par la suppression de la ligne côté serveur.
      if (target.photoPath) deleteHorsePhotoRemote(id).catch(() => {});

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
        if (fallbackId) SecureStore.setItemAsync(SELECTED_KEY, fallbackId).catch(() => {});
      }
    },
    [horses, persist, selectedHorseId]
  );

  const updateHorsePhoto = useCallback(
    (id: string, photoUrl: string) => {
      setHorses((prev) => {
        const next = prev.map((h) => (h.id === id ? { ...h, photoUrl } : h));
        persist(next, [id]);
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
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    const primaryId = next.find((h) => h.isPrimary)?.id ?? next[0]?.id ?? null;
    setSelectedHorseId(primaryId);
    if (primaryId) SecureStore.setItemAsync(SELECTED_KEY, primaryId).catch(() => {});
  }, []);

  const selectHorse = useCallback((id: string) => {
    setSelectedHorseId(id);
    SecureStore.setItemAsync(SELECTED_KEY, id).catch(() => {});
  }, []);

  const clearAll = useCallback(async () => {
    // Best-effort : cf. audit crash SecureStore Apple Sign In du 2026-09-09 —
    // ces deletes tournent dans le second Promise.all de
    // (auth)/login.tsx.afterSuccessfulAuth (compte jamais onboardé), un rejet
    // non catché ici plantait tout le groupe.
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(SELECTED_KEY).catch(() => {}),
    ]);
    setHorses(DEFAULT_HORSES);
    setSelectedHorseId(DEFAULT_HORSES.find((h) => h.isPrimary)?.id ?? DEFAULT_HORSES[0]?.id ?? null);
  }, []);

  const selectedHorse = useMemo(
    () => horses.find((h) => h.id === selectedHorseId) ?? horses.find((h) => h.isPrimary) ?? horses[0] ?? null,
    [horses, selectedHorseId]
  );

  const retrySync = useCallback(() => persist(horses), [persist, horses]);

  const value = useMemo<HorsesContextValue>(
    () => ({
      loading,
      horses,
      addHorse,
      updateHorse,
      updateHorseHealth,
      replaceHorses,
      hydrateFromCloud,
      updateHorsePhoto,
      removeHorse,
      selectedHorse,
      selectHorse,
      clearAll,
      syncFailed,
      retrySync,
    }),
    [
      loading,
      horses,
      addHorse,
      updateHorse,
      updateHorseHealth,
      replaceHorses,
      hydrateFromCloud,
      updateHorsePhoto,
      removeHorse,
      selectedHorse,
      selectHorse,
      clearAll,
      syncFailed,
      retrySync,
    ]
  );

  return <HorsesContext.Provider value={value}>{children}</HorsesContext.Provider>;
}

export function useHorses() {
  const ctx = useContext(HorsesContext);
  if (!ctx) throw new Error("useHorses doit être utilisé dans <HorsesProvider>");
  return ctx;
}
