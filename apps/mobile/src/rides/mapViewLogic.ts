/**
 * Fond de carte sous le tracé d'une séance (relecture et carte partagée).
 * Logique pure, testée dans mapViewLogic.test.ts.
 *
 * Fournisseur : Apple Plans (MapKit, via react-native-maps) — gratuit pour
 * une app iOS, sans clé ni compte, avec plan, satellite et vue 3D. Android
 * n'a pas de fond de carte (Google Maps y demanderait une clé) : le tracé
 * seul, comme avant. Les tuiles sont demandées par l'iPhone à Apple ;
 * aucun lieu ne passe par nos serveurs.
 */

export type MapStyle = "trace" | "standard" | "satellite" | "3d";

/** Relecture (vue privée) : tous les styles. */
export const REPLAY_MAP_STYLES: MapStyle[] = ["trace", "standard", "satellite", "3d"];
/** Carte partagée : sans fond d'office (l'écurie ne se devine pas) ; la 3D,
 * inclinée, rendrait mal dans le cadre de la story. */
export const SHARE_MAP_STYLES: MapStyle[] = ["trace", "standard", "satellite"];

/** Clé de mémorisation du style choisi dans la relecture. */
export const REPLAY_MAP_STYLE_KEY = "ride_replay_map_style_v1";

export function mapAvailable(platform: string): boolean {
  return platform === "ios";
}

export function mapTypeFor(style: Exclude<MapStyle, "trace">): "standard" | "hybrid" | "hybridFlyover" {
  if (style === "satellite") return "hybrid";
  if (style === "3d") return "hybridFlyover";
  return "standard";
}

/** Plus petite fenêtre affichée (~330 m) : un tracé de quelques mètres
 * garde de quoi se repérer autour. */
const MIN_DELTA = 0.003;
/** Marge autour du tracé, en part de son étendue. */
const MARGIN = 0.35;

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function regionFor(coords: { lat: number; lng: number }[]): Region | null {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * (1 + 2 * MARGIN)),
    longitudeDelta: Math.max(MIN_DELTA, (maxLng - minLng) * (1 + 2 * MARGIN)),
  };
}

export type Camera = {
  center: { latitude: number; longitude: number };
  pitch: number;
  heading: number;
  altitude: number;
  zoom: number;
};

/** Caméra qui cadre le tracé ; la 3D incline la vue (relief, bâtiments). */
export function cameraFor(coords: { lat: number; lng: number }[], style: MapStyle): Camera | null {
  const region = regionFor(coords);
  if (!region) return null;
  // Étendue en mètres (1° de latitude ≈ 111 km), puis altitude qui la contient.
  const kx = Math.cos((region.latitude * Math.PI) / 180);
  const spanM = Math.max(region.latitudeDelta, region.longitudeDelta * kx) * 111_000;
  const tilted = style === "3d";
  return {
    center: { latitude: region.latitude, longitude: region.longitude },
    pitch: tilted ? 55 : 0,
    heading: 0,
    altitude: Math.round(spanM * (tilted ? 1.6 : 1.3)),
    zoom: Math.max(3, Math.min(19, Math.round(Math.log2(40_000_000 / spanM)))),
  };
}

export function reviveMapStyle(raw: unknown, fallback: MapStyle): MapStyle {
  return REPLAY_MAP_STYLES.includes(raw as MapStyle) ? (raw as MapStyle) : fallback;
}
