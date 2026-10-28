import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { readJsonChecked, removeJson, writeJson } from "@/lib/localStore";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import type { ActivityType } from "@/agenda/store";
import {
  acceptPoint,
  downsample,
  encodePolyline,
  summarizeRide,
  type RidePause,
  type RidePoint,
} from "@/rides/rideMath";
import type { SessionRide } from "@/rides/types";
import { t } from "@/i18n";

/**
 * Enregistreur de la séance en direct : chrono, pauses et points GPS.
 *
 * Un seul enregistrement à la fois, gardé ici, hors de React : la tâche GPS
 * d'arrière-plan (écran verrouillé, téléphone dans la poche) doit pouvoir
 * ajouter des points sans qu'aucun écran soit monté. Les écrans s'abonnent
 * (useRideDraft, rides/useRide.ts).
 *
 * Le brouillon est écrit sur le téléphone régulièrement : si iOS ferme l'app
 * pendant la balade, la séance reprend au relancement au lieu d'être perdue.
 *
 * Autorisation : « pendant l'utilisation » suffit. L'enregistrement démarre
 * app ouverte ; iOS le poursuit écran verrouillé (mode arrière-plan
 * « location », pastille bleue), Android via un service de premier plan et
 * sa notification. Jamais d'accès « toujours ».
 */

export const RIDE_TASK = "horsetrack-ride-location";
const DRAFT_KEY = "ride_in_progress_v1";
/** Un point toutes les 2 s suffit pour les allures et le tracé, et garde un
 * brouillon léger (une balade de 2 h ≈ 3 600 points). */
const MIN_POINT_INTERVAL_MS = 2000;
const PERSIST_EVERY_MS = 20_000;

export type RideDraft = {
  sessionId: string | null;
  horseId: string;
  activityType: ActivityType;
  customActivityLabel: string | null;
  gps: boolean;
  startedAt: number;
  pauses: RidePause[];
  points: RidePoint[];
  /** Partage de sécurité en cours (cf. rides/safety.ts), null sinon. */
  safety: { token: string; viewUrl: string } | null;
  /** Posé par « Terminer » : la séance attend « Enregistrer » ou « Supprimer »
   * (écran de bilan), même après un redémarrage de l'app. */
  endedAt: number | null;
};

let draft: RideDraft | null = null;
/** Relecture du brouillon, partagée : la tâche GPS et le démarrage de l'app
 * peuvent la demander en même temps. */
let restoring: Promise<void> | null = null;
let lastPersist = 0;
const listeners = new Set<() => void>();
const pointListeners = new Set<(draft: RideDraft) => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeRide(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Appelé à chaque point GPS gardé (cf. rides/safety.ts). */
export function onRidePoint(listener: (draft: RideDraft) => void): () => void {
  pointListeners.add(listener);
  return () => pointListeners.delete(listener);
}

export function getRideDraft(): RideDraft | null {
  return draft;
}

export function isRidePaused(d: RideDraft | null = draft): boolean {
  return !!d && d.pauses.length > 0 && d.pauses[d.pauses.length - 1].end === null;
}

function persist(force = false) {
  const now = Date.now();
  if (!force && now - lastPersist < PERSIST_EVERY_MS) return;
  lastPersist = now;
  if (draft) void writeJson(DRAFT_KEY, draft);
  else void removeJson(DRAFT_KEY);
}

type TaskLocation = { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null } };

export function appendLocations(locations: TaskLocation[]): void {
  if (!draft || draft.endedAt !== null || isRidePaused()) return;
  let added = false;
  for (const loc of locations) {
    const p: RidePoint = {
      t: loc.timestamp,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      acc: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
    };
    if (p.t < draft.startedAt) continue;
    const prev = draft.points[draft.points.length - 1] ?? null;
    if (prev && p.t - prev.t < MIN_POINT_INTERVAL_MS) continue;
    if (!acceptPoint(prev, p)) continue;
    draft.points.push(p);
    added = true;
  }
  if (!added) return;
  // Nouvel objet : les écrans abonnés comparent par identité.
  draft = { ...draft };
  emit();
  for (const l of pointListeners) l(draft);
  persist();
}

// Définie au chargement du module (importé par app/_layout.tsx) : iOS et
// Android exigent que la tâche existe avant de lui livrer des positions.
if (Platform.OS !== "web") {
  TaskManager.defineTask<{ locations: TaskLocation[] }>(RIDE_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    // App relancée en arrière-plan par le système pour livrer des positions
    // (Android, service de premier plan) : aucun écran n'est monté et le
    // brouillon n'a pas encore été relu. Sans cette attente, les points
    // arrivaient sur un enregistreur vide et étaient perdus.
    await restoreRide().catch(() => {});
    appendLocations(data.locations);
  });
}

async function startLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RIDE_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(RIDE_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    // Aucun filtre de distance : à l'arrêt, les points continuent d'arriver,
    // c'est ce qui permet de détecter une chute (cf. rideMath.isImmobile).
    distanceInterval: 0,
    timeInterval: MIN_POINT_INTERVAL_MS,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: t("Séance en cours"),
      notificationBody: t("Horsetrack enregistre ton parcours."),
      killServiceOnDestroy: false,
    },
  });
}

async function stopLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RIDE_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(RIDE_TASK).catch(() => {});
  }
}

export type StartRideResult = { ok: true } | { ok: false; reason: "permission" | "unavailable" };

export async function startRide(
  options: Omit<RideDraft, "startedAt" | "pauses" | "points" | "safety" | "endedAt">
): Promise<StartRideResult> {
  if (options.gps) {
    const { granted } = await runNativeInteraction(() => Location.requestForegroundPermissionsAsync());
    if (!granted) return { ok: false, reason: "permission" };
  }
  draft = { ...options, startedAt: Date.now(), pauses: [], points: [], safety: null, endedAt: null };
  persist(true);
  emit();
  if (options.gps) {
    try {
      await startLocationUpdates();
    } catch (e) {
      console.warn("[ride] GPS indisponible", e);
      draft = null;
      persist(true);
      emit();
      return { ok: false, reason: "unavailable" };
    }
  }
  return { ok: true };
}

export function pauseRide(): void {
  if (!draft || draft.endedAt !== null || isRidePaused()) return;
  draft = { ...draft, pauses: [...draft.pauses, { start: Date.now(), end: null }] };
  persist(true);
  emit();
}

export function resumeRide(): void {
  if (!draft || draft.endedAt !== null || !isRidePaused()) return;
  const pauses = draft.pauses.slice();
  pauses[pauses.length - 1] = { ...pauses[pauses.length - 1], end: Date.now() };
  draft = { ...draft, pauses };
  persist(true);
  emit();
}

export function setRideSafety(safety: RideDraft["safety"]): void {
  if (!draft) return;
  draft = { ...draft, safety };
  persist(true);
  emit();
}

/** Construit le parcours final à partir du brouillon. */
export function buildSessionRide(d: RideDraft, endedAt: number): SessionRide {
  // Une pause encore ouverte au moment de terminer se ferme là.
  const pauses = d.pauses.map((p) => (p.end === null ? { ...p, end: endedAt } : p));
  const stats = summarizeRide(d.points, pauses, d.startedAt, endedAt);
  return {
    startedAt: new Date(d.startedAt),
    endedAt: new Date(endedAt),
    durationSeconds: stats.durationSeconds,
    distanceMeters: stats.distanceMeters,
    walkSeconds: stats.gaitSeconds.walk,
    trotSeconds: stats.gaitSeconds.trot,
    canterSeconds: stats.gaitSeconds.canter,
    haltSeconds: stats.gaitSeconds.halt,
    maxSpeedKmh: stats.maxSpeedKmh,
    avgSpeedKmh: stats.avgSpeedKmh,
    gps: d.gps,
    // ~600 points : de quoi dessiner le tracé, quelques Ko une fois encodé.
    route: d.gps && d.points.length > 1 ? encodePolyline(downsample(d.points, 600)) : null,
  };
}

/** Arrête l'enregistrement : le brouillon passe à l'état « terminé » et
 * reste sur le téléphone jusqu'à `clearRide`, si bien qu'un plantage ou une
 * fermeture entre « Terminer » et « Enregistrer » ne perd rien. */
export async function finishRide(): Promise<RideDraft | null> {
  if (!draft) return null;
  if (draft.endedAt === null) draft = { ...draft, endedAt: Date.now() };
  persist(true);
  emit();
  await stopLocationUpdates();
  return draft;
}

/** Oublie l'enregistrement (après « Enregistrer » ou « Supprimer »). */
export async function clearRide(): Promise<void> {
  await stopLocationUpdates();
  draft = null;
  persist(true);
  emit();
}

/**
 * Au démarrage de l'app : reprend une séance interrompue (app fermée par
 * iOS pendant la balade, téléphone redémarré). Le GPS repart s'il était
 * actif et que la séance n'est pas en pause.
 */
export function restoreRide(): Promise<void> {
  restoring ??= (async () => {
    const { ok, value } = await readJsonChecked<RideDraft | null>(DRAFT_KEY, null);
    if (!ok || !value || draft) return;
    // Brouillon d'une version précédente : pas encore de `endedAt`.
    draft = { ...value, endedAt: value.endedAt ?? null };
    emit();
    if (draft.gps && draft.endedAt === null && !isRidePaused()) {
      const { granted } = await Location.getForegroundPermissionsAsync().catch(() => ({ granted: false }));
      if (granted) await startLocationUpdates().catch(() => {});
    }
  })();
  return restoring;
}
