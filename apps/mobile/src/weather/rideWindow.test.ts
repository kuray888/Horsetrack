import { describe, expect, it } from "vitest";
import { bestRideWindow, weatherAlerts } from "./rideWindow";
import type { WeatherHour } from "@/lib/weatherForecast";

const h = (day: number, hour: number, o: Partial<WeatherHour> = {}): WeatherHour => ({
  time: new Date(2026, 10, day, hour).toISOString(),
  tempC: 12,
  code: 1,
  precipMm: 0,
  windKmh: 10,
  ...o,
});
const range = (day: number, from: number, to: number, o: (hour: number) => Partial<WeatherHour> = () => ({})) =>
  Array.from({ length: to - from + 1 }, (_, i) => h(day, from + i, o(from + i)));

describe("meilleur créneau pour monter", () => {
  it("la plus longue plage sèche, sans vent fort, en journée, à partir de maintenant", () => {
    const hours = range(12, 6, 21, (hr) => (hr >= 9 && hr <= 10 ? { code: 63, precipMm: 1.5 } : hr === 16 ? { windKmh: 45 } : {}));
    // 8 h exclue (passée) ; 11 h – 16 h sec, 16 h venteux → 11 h à 16 h.
    expect(bestRideWindow(hours, new Date(2026, 10, 12, 8, 30))).toEqual({
      start: new Date(2026, 10, 12, 11),
      end: new Date(2026, 10, 12, 16),
      tempC: 12,
    });
  });

  it("à égalité, la plus proche ; la température affichée est la plus haute de la plage", () => {
    const hours = range(12, 8, 20, (hr) => (hr === 11 || hr === 12 || hr === 15 ? { code: 61, precipMm: 0.6 } : { tempC: hr }));
    // 8–10 (3 h) et 16–20 (5 h) : la plus longue gagne.
    expect(bestRideWindow(hours, new Date(2026, 10, 12, 7))).toEqual({
      start: new Date(2026, 10, 12, 16),
      end: new Date(2026, 10, 12, 21),
      tempC: 20,
    });
  });

  it("gel, canicule ou pluie toute la journée : pas de créneau à conseiller", () => {
    expect(bestRideWindow(range(12, 8, 20, () => ({ code: 63, precipMm: 2 })), new Date(2026, 10, 12, 7))).toBeNull();
    expect(bestRideWindow(range(12, 8, 20, () => ({ tempC: -4 })), new Date(2026, 10, 12, 7))).toBeNull();
    expect(bestRideWindow(range(12, 8, 20, () => ({ tempC: 33 })), new Date(2026, 10, 12, 7))).toBeNull();
  });

  it("le soir, il n'y a plus de créneau aujourd'hui", () => {
    expect(bestRideWindow(range(12, 8, 20), new Date(2026, 10, 12, 20, 30))).toBeNull();
  });

  it("une petite bruine (< 0,2 mm) ne gâche pas l'heure ; une heure de pluie la coupe", () => {
    const hours = range(12, 9, 12, (hr) => (hr === 10 ? { code: 51, precipMm: 0.1 } : {}));
    expect(bestRideWindow(hours, new Date(2026, 10, 12, 8))?.start).toEqual(new Date(2026, 10, 12, 9));
    expect(bestRideWindow(hours, new Date(2026, 10, 12, 8))?.end).toEqual(new Date(2026, 10, 12, 13));
  });
});

describe("alertes météo du jour", () => {
  const now = new Date(2026, 10, 12, 7);
  it("gel, canicule, vent fort, orage : chacun une fois", () => {
    const hours = [h(12, 7, { tempC: -2 }), h(12, 8, { tempC: -1 }), h(12, 14, { windKmh: 55 }), h(12, 17, { code: 95 })];
    expect(weatherAlerts(hours, now)).toEqual(["frost", "wind", "storm"]);
    expect(weatherAlerts([h(12, 15, { tempC: 31 })], now)).toEqual(["heat"]);
  });

  it("ne regarde que les prochaines 24 h", () => {
    expect(weatherAlerts([h(14, 15, { code: 95 }), h(11, 15, { tempC: -5 })], now)).toEqual([]);
    expect(weatherAlerts([h(12, 12)], now)).toEqual([]);
  });
});
