import { Linking, Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Liens sortants de l'app (téléchargement, support, avis App Store).
 *
 * `DOWNLOAD_URL` : une seule adresse stable pour tout ce qui fait connaître
 * l'app (invitation DP/coach, partage d'un cheval, bilan du mois,
 * recommandation). Servie par l'API (cf. apps/api/src/app/telecharger), qui
 * redirige vers l'App Store ou Google Play selon le téléphone — l'adresse des
 * fiches store peut changer sans republier l'app.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? null;

export const DOWNLOAD_URL: string | null = API_URL ? `${API_URL}/telecharger` : null;

export const SUPPORT_EMAIL = "horsetrack.app@gmail.com";

/** Identifiant numérique App Store (ex. « 6741234567 »), pour le lien
 * « Noter Horsetrack ». Absent tant que l'app n'est pas publiée. */
const APP_STORE_ID = process.env.EXPO_PUBLIC_APP_STORE_ID;

/** Ouvre la page d'écriture d'avis de l'App Store / du Play Store. Renvoie
 * false si aucun lien n'est configuré (bouton à masquer). */
export function canOpenWriteReview(): boolean {
  return Platform.OS === "ios" ? !!APP_STORE_ID : true;
}

export async function openWriteReview(): Promise<void> {
  const url =
    Platform.OS === "ios"
      ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
      : "market://details?id=com.horsetrack.app";
  await Linking.openURL(url).catch(() => {});
}

/** Email au support prérempli avec ce qui aide à diagnostiquer (version,
 * système) — rien de personnel au-delà de ce que l'utilisateur écrit. */
export async function openSupportEmail(): Promise<boolean> {
  const version = Constants.expoConfig?.version ?? "?";
  const subject = encodeURIComponent("Horsetrack — une question");
  const body = encodeURIComponent(
    `\n\n\n—\nHorsetrack ${version} · ${Platform.OS === "ios" ? "iOS" : "Android"} ${String(Platform.Version)}`
  );
  const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
