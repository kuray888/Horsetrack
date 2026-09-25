import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import {
  pullAppointments,
  pullCloudData,
  pullDocuments,
  pullExpenses,
  pullJournalEntries,
  pullTrainingSessions,
  pullWeightMeasurements,
  retryPendingWrites,
} from "@/lib/cloudSync";
import { pullSharedHorses } from "@/lib/sharing";
import { loadRemoteIndex } from "@/lib/remoteIndex";
import { ensureSyncQueueLoaded } from "@/lib/syncQueue";
import { getLocalDataOwner } from "@/lib/deviceOwner";
import { isOnboardingCompleted } from "@/onboarding/completion";
import { useHorses } from "@/horses/store";
import { useAgenda } from "@/agenda/store";
import { useSessions } from "@/sessions/store";
import { useWeight } from "@/horses/weightStore";
import { useGoals, pullAllGoals } from "@/goals/store";

/**
 * Relecture régulière du serveur, fusionnée avec les données locales.
 *
 * Jusqu'ici l'app ne relisait le serveur qu'à la connexion sur un appareil
 * vierge : une demi-pension ne voyait jamais les nouveaux rendez-vous du
 * propriétaire (ni l'inverse) sans se reconnecter, et un second appareil
 * restait figé. Désormais :
 * - au lancement (une fois les données locales chargées) ;
 * - au retour dans l'app, au plus toutes les 5 minutes ;
 * - à la demande (tirer pour rafraîchir, cf. useCloudRefresh).
 *
 * Les règles de fusion — rien de ce qui n'a pas encore été envoyé n'est
 * jamais écrasé ni supprimé — sont dans lib/mergeRemote.ts ; l'état de
 * synchronisation de chaque ligne dans lib/remoteIndex.ts.
 *
 * Ne tourne que si les données locales appartiennent bien au compte connecté
 * (cf. lib/deviceOwner.ts) et que l'onboarding est terminé : pendant une
 * inscription ou un changement de compte, c'est la connexion qui restaure.
 */

const FOREGROUND_MIN_INTERVAL_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 2500;

type CloudRefreshValue = {
  /** Relit le serveur maintenant. Résout quand la fusion est faite (ou
   * abandonnée : hors ligne, pas de compte…). Ne rejette jamais. */
  refresh: () => Promise<void>;
  refreshing: boolean;
};

const CloudRefreshContext = createContext<CloudRefreshValue>({ refresh: async () => {}, refreshing: false });

export function CloudRefreshProvider({ children }: { children: ReactNode }) {
  const horses = useHorses();
  const agenda = useAgenda();
  const sessions = useSessions();
  const weight = useWeight();
  const goals = useGoals();
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef<Promise<void> | null>(null);
  const lastRunAt = useRef(0);

  // Dernières versions des stores, lues au moment de la fusion (après les
  // relectures réseau) plutôt que capturées au départ.
  const stores = useRef({ horses, agenda, sessions, weight, goals });
  useEffect(() => {
    stores.current = { horses, agenda, sessions, weight, goals };
  }, [horses, agenda, sessions, weight, goals]);

  const ready = !horses.loading && agenda.syncReady && !sessions.loading && !weight.loading && !goals.loading;

  const run = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    if ((await getLocalDataOwner()) !== userId) return;
    if (!(await isOnboardingCompleted())) return;

    await Promise.all([loadRemoteIndex(), ensureSyncQueueLoaded()]);
    // Envoyer d'abord ce qui attend : moins de lignes « protégées » à la
    // fusion, et le serveur relu contient déjà nos dernières écritures.
    await retryPendingWrites().catch(() => {});

    const pullStartedAt = Date.now();
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [cloud, shared, appointments, documents, journal, trainingSessions, expenses, goalList, weights] = await Promise.all([
      safe(pullCloudData()),
      safe(pullSharedHorses()),
      safe(pullAppointments()),
      safe(pullDocuments()),
      safe(pullJournalEntries()),
      safe(pullTrainingSessions()),
      safe(pullExpenses()),
      safe(pullAllGoals()),
      safe(pullWeightMeasurements()),
    ]);

    // Changement de compte pendant les relectures : ne rien fusionner.
    const { data: after } = await supabase.auth.getSession();
    if (after.session?.user.id !== userId) return;

    const s = stores.current;
    // Chevaux : les deux listes sont nécessaires pour reconstituer l'écurie
    // (possédés + partagés) — sans l'une, une absence ne prouverait rien.
    if (cloud && shared) s.horses.mergeFromCloud(cloud.horses, shared, pullStartedAt);
    s.agenda.mergeFromCloud(
      {
        appointments: appointments ?? undefined,
        documents: documents ?? undefined,
        journal: journal ?? undefined,
        expenses: expenses ?? undefined,
      },
      pullStartedAt
    );
    if (trainingSessions) s.sessions.mergeFromCloud(trainingSessions, pullStartedAt);
    if (weights) s.weight.mergeFromCloud(weights, pullStartedAt);
    if (goalList) s.goals.mergeFromCloud(goalList, pullStartedAt);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (running.current) return running.current;
    lastRunAt.current = Date.now();
    setRefreshing(true);
    const current = run()
      .catch((e) => console.warn("[cloudRefresh] relecture échouée", e))
      .finally(() => {
        running.current = null;
        setRefreshing(false);
      });
    running.current = current;
    return current;
  }, [run]);

  // Premier passage une fois TOUTES les données locales chargées.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!ready || startedRef.current) return;
    startedRef.current = true;
    const timer = setTimeout(() => void refresh(), STARTUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, refresh]);

  // Retour dans l'app.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !startedRef.current) return;
      if (Date.now() - lastRunAt.current < FOREGROUND_MIN_INTERVAL_MS) return;
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(() => ({ refresh, refreshing }), [refresh, refreshing]);
  return <CloudRefreshContext.Provider value={value}>{children}</CloudRefreshContext.Provider>;
}

export function useCloudRefresh(): CloudRefreshValue {
  return useContext(CloudRefreshContext);
}
