import { encodePolyline } from "@/rides/rideMath";
import { maskRouteEnds } from "@/rides/shareCardLogic";
import type { SessionRide } from "@/rides/types";

/**
 * Lien public d'une séance (cf. apps/api/src/lib/publicRide.ts) : créé
 * volontairement depuis la carte à partager, supprimable à tout moment. Ne part
 * que ce que la carte montre déjà — jamais de nom, de position brute ni d'email.
 */
export type PublicRidePayload = {
  sessionId: string;
  horseName: string;
  activity: string;
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  walkSeconds: number;
  trotSeconds: number;
  canterSeconds: number;
  route: string | null;
  endsHidden: boolean;
};

export function buildPublicRidePayload(input: {
  ride: SessionRide;
  sessionId: string;
  horseName: string | null;
  activity: string;
  fullRoute: { lat: number; lng: number }[];
  hideEnds: boolean;
}): PublicRidePayload {
  const { ride, hideEnds } = input;
  const shown = hideEnds ? maskRouteEnds(input.fullRoute, 200) : input.fullRoute;
  return {
    sessionId: input.sessionId,
    horseName: input.horseName ?? "",
    activity: input.activity,
    startedAt: ride.startedAt.toISOString(),
    durationSeconds: Math.max(1, ride.durationSeconds),
    distanceMeters: ride.distanceMeters,
    avgSpeedKmh: ride.avgSpeedKmh,
    walkSeconds: ride.walkSeconds,
    trotSeconds: ride.trotSeconds,
    canterSeconds: ride.canterSeconds,
    route: ride.gps && shown.length > 1 ? encodePolyline(shown) : null,
    endsHidden: hideEnds,
  };
}

