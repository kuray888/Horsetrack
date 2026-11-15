/** Ajoute `fromHorse` à une destination d'onglet (chaîne ou objet). */
export function withFromHorse<H extends string | { pathname: string; params?: Record<string, string> }>(href: H, horseId: string): H {
  if (typeof href === "string") {
    return `${href}${href.includes("?") ? "&" : "?"}fromHorse=${encodeURIComponent(horseId)}` as H;
  }
  const obj = href as { pathname: string; params?: Record<string, string> };
  return { pathname: obj.pathname, params: { ...(obj.params ?? {}), fromHorse: horseId } } as unknown as H;
}
