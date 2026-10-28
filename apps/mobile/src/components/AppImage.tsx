import { Image as ExpoImage, type ImageProps } from "expo-image";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Image de l'app (expo-image) avec un fondu d'apparition par défaut : une
 * photo qui arrive du réseau (cheval, journal, document) se pose en douceur
 * au lieu de surgir. Toutes les propriétés restent surchargeables.
 */
export function Image(props: ImageProps) {
  return <ExpoImage transition={prefersReducedMotion() ? 0 : 200} {...props} />;
}
