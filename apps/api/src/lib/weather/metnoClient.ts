import { cacheKey, parseLocationforecast, type WeatherHour } from "./metno";

/** Identification exigée par MET (sinon 403) : application + site. */
export const MET_USER_AGENT = "Horsetrack/1.3 https://horsetrack.fr";
const BASE = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
/** Sans en-tête Expires exploitable, on garde la réponse 30 min. */
const DEFAULT_TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 2000;

type Entry = { hours: WeatherHour[]; expiresAt: number; lastModified: string | null };

export type Forecast = { hours: WeatherHour[]; maxAgeSeconds: number };

/**
 * Cache par kilomètre, en mémoire de l'instance serveur : suffit à respecter
 * `Expires` (MET ne met à jour qu'environ toutes les heures) aux volumes
 * actuels. Une instance neuve redemande simplement une fois.
 */
export function createMetnoClient(deps: {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number;
}) {
  const cache = new Map<string, Entry>();

  function expiresFrom(res: Response): number {
    const parsed = Date.parse(res.headers.get("expires") ?? "");
    return Number.isFinite(parsed) ? parsed : deps.now() + DEFAULT_TTL_MS;
  }

  function result(entry: Entry): Forecast {
    return { hours: entry.hours, maxAgeSeconds: Math.max(60, Math.round((entry.expiresAt - deps.now()) / 1000)) };
  }

  return {
    async forecast(lat: number, lon: number): Promise<Forecast | null> {
      const pos = cacheKey(lat, lon);
      if (!pos) return null;
      const cached = cache.get(pos.key);
      if (cached && deps.now() < cached.expiresAt) return result(cached);
      const headers: Record<string, string> = { "User-Agent": MET_USER_AGENT, Accept: "application/json" };
      if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;
      try {
        const res = await deps.fetchFn(`${BASE}?lat=${pos.lat}&lon=${pos.lon}`, { headers });
        if (res.status === 304 && cached) {
          const entry = { ...cached, expiresAt: expiresFrom(res) };
          cache.set(pos.key, entry);
          return result(entry);
        }
        if (!res.ok) return cached ? result(cached) : null;
        const hours = parseLocationforecast(await res.json());
        if (hours.length === 0) return cached ? result(cached) : null;
        const entry = { hours, expiresAt: expiresFrom(res), lastModified: res.headers.get("last-modified") };
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
        cache.set(pos.key, entry);
        return result(entry);
      } catch {
        return cached ? result(cached) : null;
      }
    },
  };
}
