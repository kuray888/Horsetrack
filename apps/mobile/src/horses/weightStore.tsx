import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { pushWeightMeasurement, deleteWeightMeasurementRemote } from "@/lib/cloudSync";
import { useHorses } from "@/horses/store";

/**
 * Suivi de poids (audit produit post-V1, phase 5) — historique de mesures par
 * cheval, même pattern de persistance locale + sync cloud best-effort que
 * sessions/store.tsx. `Horse.weightKg` (déjà existant, affiché partout
 * ailleurs dans l'app sans changement) reste le "poids actuel" : chaque
 * nouvelle mesure le met aussi à jour via updateHorse, les deux ne divergent
 * donc jamais — pas de deuxième source de vérité.
 */

export type WeightMeasurement = {
  id: string;
  horseId: string;
  weightKg: number;
  date: Date;
};

const WEIGHT_KEY = "weight_measurements_v1";

function generateId(): string {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type WeightContextValue = {
  measurements: WeightMeasurement[];
  /** Ajoute une mesure pour le cheval sélectionné et met à jour Horse.weightKg
   * en même temps (cf. commentaire de tête). */
  addMeasurement: (weightKg: number, date: Date) => void;
  deleteMeasurement: (id: string) => void;
  hydrateFromCloud: (measurements: WeightMeasurement[]) => void;
  clearAll: () => Promise<void>;
  loading: boolean;
};

const WeightContext = createContext<WeightContextValue | null>(null);

export function WeightProvider({ children }: { children: ReactNode }) {
  const { selectedHorse, updateHorse } = useHorses();
  const [measurements, setMeasurements] = useState<WeightMeasurement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(WEIGHT_KEY);
        const parsed = safeJsonParse<WeightMeasurement[] | null>(raw, null);
        if (parsed) {
          setMeasurements(parsed.map((m) => ({ ...m, date: new Date(m.date) })));
        }
      } catch (e) {
        console.warn("[weight] lecture SecureStore échouée", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(WEIGHT_KEY, JSON.stringify(measurements));
  }, [measurements, loaded]);

  const addMeasurement = useCallback(
    (weightKg: number, date: Date) => {
      if (!selectedHorse) return;
      const next: WeightMeasurement = { id: generateId(), horseId: selectedHorse.id, weightKg, date };
      setMeasurements((list) => [...list, next]);
      pushWeightMeasurement(next).catch(() => {});
      // Garde Horse.weightKg (affiché ailleurs : Horse Hub, formulaires...)
      // aligné sur la dernière mesure connue de CE cheval, pas juste la plus
      // récemment ajoutée toutes horloges confondues (une mesure du passé
      // saisie en retard ne doit pas écraser une mesure plus récente déjà là).
      const horseMeasurements = [...measurements, next].filter((m) => m.horseId === selectedHorse.id);
      const latest = horseMeasurements.reduce((a, b) => (b.date > a.date ? b : a));
      if (latest.id === next.id) {
        const { id: _id, emoji: _emoji, photoPath: _photoPath, isPrimary: _isPrimary, sharedRole: _sharedRole, ...rest } =
          selectedHorse;
        updateHorse(selectedHorse.id, { ...rest, weightKg });
      }
    },
    [selectedHorse, measurements, updateHorse]
  );

  const deleteMeasurement = useCallback((id: string) => {
    setMeasurements((list) => list.filter((m) => m.id !== id));
    deleteWeightMeasurementRemote(id).catch(() => {});
  }, []);

  const hydrateFromCloud = useCallback((remote: WeightMeasurement[]) => {
    setMeasurements(remote);
    SecureStore.setItemAsync(WEIGHT_KEY, JSON.stringify(remote));
  }, []);

  const clearAll = useCallback(async () => {
    await SecureStore.deleteItemAsync(WEIGHT_KEY);
    setMeasurements([]);
  }, []);

  const value = useMemo<WeightContextValue>(
    () => ({ measurements, addMeasurement, deleteMeasurement, hydrateFromCloud, clearAll, loading: !loaded }),
    [measurements, addMeasurement, deleteMeasurement, hydrateFromCloud, clearAll, loaded]
  );

  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

export function useWeight() {
  const ctx = useContext(WeightContext);
  if (!ctx) throw new Error("useWeight doit être utilisé dans <WeightProvider>");
  return ctx;
}
