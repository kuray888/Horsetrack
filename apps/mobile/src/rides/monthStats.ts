import type { SessionRide } from "@/rides/types";

/**
 * Bilan du mois des séances en direct d'un cheval (Premium, 1.3.0) — logique
 * pure. La séance en direct elle-même reste gratuite pour tous (décision du
 * 2026-11-13) : seul ce cumul, nouveau, est réservé à Premium.
 */

export type RideLike = { id: string; horseId: string | null; date: Date; ride?: SessionRide | null; cancelledAt?: Date | null };

export type MonthTotals = { rides: number; distanceMeters: number; seconds: number; canterSeconds: number };

export type RideMonthStats = {
  month: MonthTotals;
  previous: MonthTotals;
  /** Évolution du temps au galop par rapport au mois précédent, en %
   * arrondi ; null sans galop le mois précédent. */
  canterChangePct: number | null;
  /** La séance courante est la plus longue (en distance) jamais enregistrée
   * pour ce cheval, et il y en avait au moins une autre avant. */
  distanceRecord: boolean;
};

const EMPTY: MonthTotals = { rides: 0, distanceMeters: 0, seconds: 0, canterSeconds: 0 };

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function totals(rides: RideLike[], month: Date): MonthTotals {
  return rides
    .filter((s) => sameMonth(s.date, month))
    .reduce<MonthTotals>(
      (acc, s) => ({
        rides: acc.rides + 1,
        distanceMeters: acc.distanceMeters + (s.ride!.gps ? s.ride!.distanceMeters : 0),
        seconds: acc.seconds + s.ride!.durationSeconds,
        canterSeconds: acc.canterSeconds + (s.ride!.gps ? s.ride!.canterSeconds : 0),
      }),
      EMPTY
    );
}

/** `current` : la séance qu'on vient de finir (pas encore forcément dans
 * `sessions`) ; elle remplace une éventuelle copie de même id. */
export function rideMonthStats(sessions: readonly RideLike[], current: RideLike): RideMonthStats {
  const rides = [...sessions.filter((s) => s.id !== current.id), current].filter(
    (s) => s.horseId === current.horseId && !!s.ride && !s.cancelledAt
  );
  const month = totals(rides, current.date);
  const previous = totals(rides, new Date(current.date.getFullYear(), current.date.getMonth() - 1, 1));
  const canterChangePct =
    previous.canterSeconds > 0 ? Math.round(((month.canterSeconds - previous.canterSeconds) / previous.canterSeconds) * 100) : null;
  const others = rides.filter((s) => s.id !== current.id && s.ride!.gps);
  const currentMeters = current.ride?.gps ? current.ride.distanceMeters : 0;
  const distanceRecord = others.length > 0 && currentMeters > 0 && others.every((s) => s.ride!.distanceMeters < currentMeters);
  return { month, previous, canterChangePct, distanceRecord };
}
