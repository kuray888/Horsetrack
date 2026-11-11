/**
 * La position ne part qu'arrondie à 0,01° (≈ 1 km), vers notre serveur, qui
 * seul interroge le prestataire météo (MET Norway) : la maille des modèles est
 * de toute façon plus large, et le prestataire ne voit ni l'adresse IP ni le
 * compte de l'utilisateur.
 */
export function coarsePosition(lat: number, lon: number): { lat: number; lon: number } {
  const round = (v: number) => Math.round(v * 100) / 100;
  return { lat: round(lat), lon: round(lon) };
}

export function weatherApiPath(lat: number, lon: number): string {
  const p = coarsePosition(lat, lon);
  return `/api/weather?lat=${p.lat}&lon=${p.lon}`;
}
