import { describe, expect, it } from "vitest";
import { coarsePosition, currentWeatherUrl, forecastUrl } from "./weatherRequest";

describe("requête météo", () => {
  it("n'envoie au prestataire qu'une position arrondie au kilomètre", () => {
    expect(coarsePosition(48.856613, 2.352222)).toEqual({ lat: 48.86, lon: 2.35 });
    expect(coarsePosition(-33.86882, 151.20929)).toEqual({ lat: -33.87, lon: 151.21 });
    const url = currentWeatherUrl(48.856613, 2.352222);
    expect(url).toContain("latitude=48.86&longitude=2.35");
    expect(url).not.toContain("856613");
  });

  it("garde les paramètres attendus par Open-Meteo", () => {
    expect(currentWeatherUrl(1, 2)).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&current=temperature_2m,weather_code"
    );
    expect(forecastUrl(45.123456, 4.987654, 5)).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=45.12&longitude=4.99&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto"
    );
  });
});
