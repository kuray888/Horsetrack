import { haversineMeters } from "@/rides/rideMath";
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
  if (route.length < 2) return [];
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
  return end - start >= 2 ? route.slice(start, end + 1) : [];
}

/** Ligne du code de parrainage sur la carte ; null sans code. */
export function shareLabel(code: string | null): string | null {
  return code ? t("Mon code : {code}", { code }) : null;
}
