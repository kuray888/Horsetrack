import Image from "next/image";
import { SCREENS, type ScreenName } from "@/content/screens";

/** Une capture réelle de l'app (téléphone détouré, fond transparent). */
export function Screen({
  name,
  sizes,
  priority = false,
  className,
  decorative = false,
}: {
  name: ScreenName;
  /** Largeur affichée, pour que le navigateur choisisse la bonne résolution. */
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Doublon visuel d'une capture déjà décrite ailleurs : ignoré par les lecteurs d'écran. */
  decorative?: boolean;
}) {
  const { image, alt } = SCREENS[name];
  return (
    <Image
      src={image}
      alt={decorative ? "" : alt}
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      quality={82}
      className={className}
      draggable={false}
    />
  );
}
