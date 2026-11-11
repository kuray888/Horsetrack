import { describe, expect, it } from "vitest";
import { cacheKey, parseLocationforecast, symbolToWmo } from "./metno";

describe("MET Norway → format de l'app", () => {
  it("traduit les symboles en codes WMO (ceux que lisent l'app et le coach)", () => {
    expect(symbolToWmo("clearsky_day")).toBe(0);
    expect(symbolToWmo("fair_night")).toBe(1);
    expect(symbolToWmo("partlycloudy_polartwilight")).toBe(2);
    expect(symbolToWmo("cloudy")).toBe(3);
    expect(symbolToWmo("fog")).toBe(45);
    expect(symbolToWmo("lightrain")).toBe(61);
    expect(symbolToWmo("heavyrainshowers_day")).toBe(82);
    // Neige et grésil : le coach y voit un sol glissant.
    expect(symbolToWmo("sleet")).toBe(67);
    expect(symbolToWmo("lightsnowshowers_night")).toBe(85);
    expect(symbolToWmo("heavysnow")).toBe(75);
    // Tout orage, quelle que soit la précipitation.
    expect(symbolToWmo("lightrainshowersandthunder_day")).toBe(95);
    expect(symbolToWmo("heavysnowandthunder")).toBe(95);
    // Symbole inconnu : nuageux plutôt qu'une erreur.
    expect(symbolToWmo("nouveau_symbole")).toBe(3);
    expect(symbolToWmo(undefined)).toBe(3);
  });

  it("garde une heure par entrée, avec température, code, pluie et vent", () => {
    const hours = parseLocationforecast({
      properties: {
        timeseries: [
          {
            time: "2026-11-12T10:00:00Z",
            data: {
              instant: { details: { air_temperature: 7.4, wind_speed: 5.2 } },
              next_1_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 1.2 } },
              next_6_hours: { summary: { symbol_code: "cloudy" } },
            },
          },
          // Au-delà de ~2,5 jours, MET ne donne plus que des pas de 6 h.
          {
            time: "2026-11-15T06:00:00Z",
            data: {
              instant: { details: { air_temperature: -1.6 } },
              next_6_hours: { summary: { symbol_code: "lightsnow" }, details: { precipitation_amount: 0.4 } },
            },
          },
          // Entrée incomplète : ignorée.
          { time: "2026-11-15T12:00:00Z", data: { instant: { details: {} } } },
        ],
      },
    });
    expect(hours).toEqual([
      { time: "2026-11-12T10:00:00Z", tempC: 7.4, code: 63, precipMm: 1.2, windKmh: 19 },
      { time: "2026-11-15T06:00:00Z", tempC: -1.6, code: 71, precipMm: 0.4, windKmh: null },
    ]);
  });

  it("réponse inattendue : liste vide, jamais d'exception", () => {
    expect(parseLocationforecast(null)).toEqual([]);
    expect(parseLocationforecast({ properties: {} })).toEqual([]);
  });

  it("clé de cache : position arrondie au km (MET refuse plus de 4 décimales)", () => {
    expect(cacheKey(48.856613, 2.352222)).toEqual({ key: "48.86,2.35", lat: 48.86, lon: 2.35 });
    expect(cacheKey(91, 0)).toBeNull();
    expect(cacheKey(Number.NaN, 2)).toBeNull();
  });
});
