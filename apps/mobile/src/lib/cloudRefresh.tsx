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
  resendUnconfirmedDeletes,
  retryPendingWrites,
} from "@/lib/cloudSync";
import { pullSharedHorses } from "@/lib/sharing";
import { loadRemoteIndex, noteServerHorses } from "@/lib/remoteIndex";
import { ensureSyncQueueLoaded } from "@/lib/syncQueue";
import { clearRejectedWrites } from "@/lib/rejectedWrites";
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
/** Délai avant la relecture de suivi : le temps que l'envoi de l'écurie aboutisse. */
const FOLLOW_UP_DELAY_MS = 8000;

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
  /** Une relecture de suivi est demandée (cf. run) — bornée pour ne jamais
   * boucler si le serveur refuse durablement un cheval. */
  const followUp = useRef(false);
  const followUpsLeft = useRef(3);
  /** Dernière version de `refresh`, pour la relecture de suivi programmée. */
  const refreshRef = useRef<(() => Promise<void>) | null>(null);

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
    // Suppressions interrompues par une fermeture de l'app (cf. remoteIndex
    // `unconfirmed`) : renvoyées avant la relecture, qui sinon les ferait
    // réapparaître ailleurs.
    await resendUnconfirmedDeletes().catch(() => {});

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

    // Les refus notés jusqu'ici repartent de zéro : les fusions ci-dessous
    // renvoient tout ce que le serveur n'a jamais reçu, et un refus toujours
    // d'actualité sera noté à nouveau (cf. lib/rejectedWrites.ts).
    clearRejectedWrites();
    const s = stores.current;
    // Chevaux présents côté serveur : une séance, un rendez-vous… n'est
    // renvoyé que si son cheval y est (cf. remoteIndex.isHorseOnServer).
    noteServerHorses(cloud && shared ? [...cloud.horses, ...shared].map((h) => h.id) : null);
    // Chevaux : les deux listes sont nécessaires pour reconstituer l'écurie
    // (possédés + partagés) — sans l'une, une absence ne prouverait rien.
    const horsesMerged = cloud && shared ? s.horses.mergeFromCloud(cloud.horses, shared, pullStartedAt) : true;
    // Écurie pas encore entièrement sur le serveur (un cheval vient d'y être
    // renvoyé) : ce qui en dépend attend ce tour-ci, on repasse peu après
    // plutôt qu'au prochain retour dans l'app.
    if (!horsesMerged) followUp.current = true;
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
    followUp.current = false;
    const current = run()
      .catch((e) => console.warn("[cloudRefresh] relecture échouée", e))
      .finally(() => {
        running.current = null;
        setRefreshing(false);
        if (followUp.current && followUpsLeft.current > 0) {
          followUpsLeft.current -= 1;
          setTimeout(() => void refreshRef.current?.(), FOLLOW_UP_DELAY_MS);
        } else if (!followUp.current) {
          followUpsLeft.current = 3;
        }
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

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const value = useMemo(() => ({ refresh, refreshing }), [refresh, refreshing]);
  return <CloudRefreshContext.Provider value={value}>{children}</CloudRefreshContext.Provider>;
}

export function useCloudRefresh(): CloudRefreshValue {
  return useContext(CloudRefreshContext);
}

type MergeTargets = {
  mergeAgenda: ReturnType<typeof useAgenda>["mergeFromCloud"];
  mergeSessions: ReturnType<typeof useSessions>["mergeFromCloud"];
  mergeWeight: ReturnType<typeof useWeight>["mergeFromCloud"];
};

/**
 * Rapatrie rendez-vous, journal, séances et pesées (ceux d'un cheval qu'on
 * vient de nous partager, cf. invites-modal.tsx, (onboarding)/pending-invites.tsx)
 * en les FUSIONNANT avec les données locales, comme la relecture régulière.
 * Ces écrans les remplaçaient jusqu'ici par la seule version du serveur : une
 * séance ou un rendez-vous saisi juste avant, pas encore confirmé par le
 * serveur, disparaissait en acceptant l'invitation (cf. audit du 2026-10-02).
 * Chaque relecture est isolée : un échec réseau sur l'une ne touche rien.
 */
export async function pullAndMergeHorseData({ mergeAgenda, mergeSessions, mergeWeight }: MergeTargets): Promise<void> {
  await Promise.all([loadRemoteIndex(), ensureSyncQueueLoaded()]);
  const pullStartedAt = Date.now();
  const [appointments, journal, trainingSessions, weights] = await Promise.all([
    pullAppointments().catch(() => null),
    pullJournalEntries().catch(() => null),
    pullTrainingSessions().catch(() => null),
    pullWeightMeasurements().catch(() => null),
  ]);
  mergeAgenda({ appointments: appointments ?? undefined, journal: journal ?? undefined }, pullStartedAt);
  if (trainingSessions) mergeSessions(trainingSessions, pullStartedAt);
  if (weights) mergeWeight(weights, pullStartedAt);
}
