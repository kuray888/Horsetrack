import { haversineMeters, type Gait } from "@/rides/rideMath";
import { t } from "@/i18n";

/** Logique pure de la carte de séance à partager (cf. RideShareCard, RideShareBlock). */
export type ShareFormat = "story" | "square";

/** Taille affichée ; la capture est agrandie à 1080 px de large. */
export function cardSize(format: ShareFormat, width: number): { width: number; height: number } {
  return { width, height: format === "story" ? Math.round((width * 16) / 9) : width };
}

/**
 * Retire les `meters` du début et de la fin du tracé : on voit la forme de la
 * balade sans deviner d'où elle part (écurie, domicile). Un parcours trop court
 * pour être masqué n'est PAS montré en entier : mieux vaut pas de tracé.
 */
export function maskRouteEnds<T extends { lat: number; lng: number }>(route: T[], meters = 200): T[] {
  const range = maskedRange(route, meters);
  return range ? route.slice(range.start, range.end + 1) : [];
}

/** Indices du premier et du dernier point gardés ; null si rien ne reste. */
function maskedRange(route: { lat: number; lng: number }[], meters: number): { start: number; end: number } | null {
  if (route.length < 2) return null;
  let start = 0;
  let walked = 0;
  while (start < route.length - 1 && walked < meters) {
    walked += haversineMeters(route[start], route[start + 1]);
    start += 1;
  }
  let end = route.length - 1;
  walked = 0;
  while (end > 0 && walked < meters) {
    walked += haversineMeters(route[end], route[end - 1]);
    end -= 1;
  }
  return end - start >= 2 ? { start, end } : null;
}

/** Tracé montré sur la carte et ses vitesses (une par point, pour colorer
 * les allures), masqué au besoin : les vitesses restent alignées point pour
 * point. `speeds` null (trace absente ou décalée) : tracé d'une seule couleur. */
export function shareRoute<T extends { lat: number; lng: number }>(
  fullRoute: T[],
  speeds: number[] | null,
  hideEnds: boolean
): { route: T[]; speeds: number[] | null } {
  const aligned = speeds && speeds.length === fullRoute.length ? speeds : null;
  if (!hideEnds) return { route: fullRoute, speeds: aligned };
  const range = maskedRange(fullRoute, 200);
  if (!range) return { route: [], speeds: null };
  return {
    route: fullRoute.slice(range.start, range.end + 1),
    speeds: aligned ? aligned.slice(range.start, range.end + 1) : null,
  };
}

/** Part de chaque allure sur la carte ; une allure qui arrondit à 0 % n'est
 * pas citée (« Galop 0 % » pour 4 secondes ne veut rien dire). */
export function gaitShares(ride: { walkSeconds: number; trotSeconds: number; canterSeconds: number }): {
  gait: Exclude<Gait, "halt">;
  seconds: number;
  percent: number;
}[] {
  const all = [
    { gait: "walk" as const, seconds: ride.walkSeconds },
    { gait: "trot" as const, seconds: ride.trotSeconds },
    { gait: "canter" as const, seconds: ride.canterSeconds },
  ];
  const total = all.reduce((n, x) => n + Math.max(0, x.seconds), 0);
  if (total <= 0) return [];
  return all
    .map((x) => ({ ...x, percent: Math.round((x.seconds / total) * 100) }))
    .filter((x) => x.percent > 0);
}

/** Ligne du code de parrainage sur la carte ; null sans code. */
export function shareLabel(code: string | null): string | null {
  return code ? t("Mon code : {code}", { code }) : null;
}
