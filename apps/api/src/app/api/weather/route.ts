import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { createMetnoClient } from "@/lib/weather/metnoClient";

const client = createMetnoClient({ fetchFn: (url, init) => fetch(url, init), now: () => Date.now() });

/**
 * Prévisions horaires pour l'app (MET Norway, cf. lib/weather/metno.ts).
 * Réservé aux comptes connectés : c'est notre identité qui part chez MET, on
 * ne l'ouvre pas à n'importe qui. Aucune donnée du compte n'est transmise ;
 * seule la position arrondie au kilomètre l'est.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const forecast = await client.forecast(lat, lon);
  if (!forecast) return NextResponse.json({ error: "Météo indisponible" }, { status: 503 });
  return NextResponse.json(
    { hours: forecast.hours, source: "MET Norway" },
    { headers: { "Cache-Control": `private, max-age=${Math.min(forecast.maxAgeSeconds, 3600)}` } }
  );
}
