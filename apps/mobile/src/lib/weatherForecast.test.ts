import { describe, expect, it } from "vitest";
import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";
import { currentFromHours, dailyFromHours, dayCode, weatherIconName, type WeatherHour } from "./weatherForecast";

/** Heure locale du téléphone → ISO UTC, comme le renvoie le serveur. */
const at = (d: number, h: number, tempC: number, code = 0, precipMm: number | null = 0): WeatherHour => ({
  time: new Date(2026, 10, d, h).toISOString(),
  tempC,
  code,
  precipMm,
  windKmh: 10,
});

describe("prévision à partir des heures", () => {
  it("météo actuelle : l'heure en cours (la plus proche, pas une heure future lointaine)", () => {
    const hours = [at(12, 9, 4), at(12, 10, 6, 3), at(12, 11, 8)];
    expect(currentFromHours(hours, new Date(2026, 10, 12, 10, 20))).toEqual({ tempC: 6, code: 3 });
    expect(currentFromHours([], new Date())).toBeNull();
    // Rien à moins de 3 h : pas de « météo actuelle » trompeuse.
    expect(currentFromHours([at(12, 20, 1)], new Date(2026, 10, 12, 10))).toBeNull();
  });

  it("regroupe par jour local : min, max, à partir d'aujourd'hui", () => {
    const hours = [at(11, 23, 2), at(12, 6, -1), at(12, 14, 9), at(12, 22, 3), at(13, 12, 11, 61, 1)];
    const days = dailyFromHours(hours, new Date(2026, 10, 12, 8), 5);
    expect(days.map((d) => [d.date.getDate(), d.tempMinC, d.tempMaxC])).toEqual([
      [12, -1, 9],
      [13, 11, 11],
    ]);
    expect(days[0].date.getHours()).toBe(0);
  });

  it("journée entamée (le soir) : signalée incomplète, le minimum n'y a pas de sens", () => {
    const days = dailyFromHours([at(12, 22, 9), at(12, 23, 9), ...[0, 6, 12, 18].map((hr) => at(13, hr, 8))], new Date(2026, 10, 12, 21), 5);
    expect(days.map((d) => d.partial)).toEqual([true, false]);
  });

  it("limite le nombre de jours", () => {
    const hours = [12, 13, 14, 15, 16, 17, 18].map((d) => at(d, 12, 10));
    expect(dailyFromHours(hours, new Date(2026, 10, 12), 5)).toHaveLength(5);
  });

  it("code du jour : orage ou neige s'il y en a, pluie si elle dure, sinon le ciel le plus fréquent en journée", () => {
    expect(dayCode([at(12, 9, 5, 0), at(12, 15, 5, 95)])).toBe(95);
    expect(dayCode([at(12, 9, 5, 1), at(12, 10, 5, 71)])).toBe(71);
    // Une seule heure d'averse ne fait pas un « jour de pluie ».
    expect(dayCode([at(12, 9, 5, 1), at(12, 10, 5, 1), at(12, 11, 5, 80)])).toBe(1);
    expect(dayCode([at(12, 9, 5, 1), at(12, 10, 5, 63), at(12, 11, 5, 61)])).toBe(63);
    // La nuit ne compte pas pour le ciel du jour.
    expect(dayCode([at(12, 2, 5, 3), at(12, 3, 5, 3), at(12, 12, 5, 0)])).toBe(0);
  });
});

describe("icônes météo", () => {
  it("chaque code WMO a une icône qui existe dans la police de l'app", () => {
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    for (const c of codes) expect((glyphMap as Record<string, number>)[weatherIconName(c)], `code ${c}`).toBeDefined();
    expect(weatherIconName(0)).toBe("weather-sunny");
    expect(weatherIconName(95)).toBe("weather-lightning-rainy");
  });
});
