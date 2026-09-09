import { Image as ExpoImage } from "expo-image";
import { cssInterop } from "nativewind";

/**
 * Remplace RN `Image` pour les photos utilisateur (cheval, journal, coffre-
 * fort) — décodage natif au format d'affichage réel + cache disque entre
 * sessions, contrairement à `Image` de React Native qui redécode l'image
 * source en entier à chaque montage (cf. audit perf du 2026-09-09 : un
 * décodage plein format synchrone à chaque ouverture du Horse Hub était une
 * cause probable de saccade). `cssInterop` une seule fois ici, pas de
 * support className pour expo-image par défaut dans NativeWind.
 */
cssInterop(ExpoImage, { className: "style" });

export const Image = ExpoImage;
