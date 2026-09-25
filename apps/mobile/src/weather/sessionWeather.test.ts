import { describe, expect, it } from "vitest";
import { FREEZING_MAX_C, sessionWeatherWarning } from "@/weather/sessionWeather";

const today = new Date(2026, 8, 22, 10, 0);
const day = (offset: number) => new Date(2026, 8, 22 + offset);

const forecastFor = (offset: number, code: number, tempMaxC = 18, tempMinC = 10) => ({
  date: day(offset),
  code,
  label: code === 95 ? "Orage" : code === 61 ? "Pluie" : "Ciel dégagé",
  icon: "🌧️",
  tempMinC,
  tempMaxC,
});

const session = (offset: number, completed = false) => ({ date: day(offset), completed });

describe("sessionWeatherWarning", () => {
  it("prévient quand de la pluie tombe sur la prochaine séance", () => {
    const warning = sessionWeatherWarning([session(1)], [forecastFor(1, 61)], today);
    expect(warning?.message).toContain("pluie annoncée");
  });

  it("ne dit rien quand la météo est sans conséquence", () => {
    expect(sessionWeatherWarning([session(1)], [forecastFor(1, 0)], today)).toBeNull();
  });

  it("ne prévient pas pour une bruine : on monte quand même", () => {
    // Prévenir pour tout reviendrait à ne prévenir pour rien.
    expect(sessionWeatherWarning([session(1)], [forecastFor(1, 51)], today)).toBeNull();
  });

  it("signale le gel même par beau temps : le sol devient impraticable", () => {
    const warning = sessionWeatherWarning([session(1)], [forecastFor(1, 0, FREEZING_MAX_C, -5)], today);
    expect(warning?.message).toContain("gel annoncé");
  });

  it("ignore les séances déjà faites et les séances passées", () => {
    expect(sessionWeatherWarning([session(1, true)], [forecastFor(1, 61)], today)).toBeNull();
    expect(sessionWeatherWarning([session(-1)], [forecastFor(-1, 61)], today)).toBeNull();
  });

  it("garde la séance du jour même, encore à faire", () => {
    expect(sessionWeatherWarning([session(0)], [forecastFor(0, 95)], today)?.message).toContain("orage");
  });

  it("ne regarde pas au-delà de l'horizon des prévisions utiles", () => {
    expect(sessionWeatherWarning([session(6)], [forecastFor(6, 61)], today)).toBeNull();
  });

  it("ne parle que de la PROCHAINE séance concernée", () => {
    const warning = sessionWeatherWarning(
      [session(2), session(1)],
      [forecastFor(1, 61), forecastFor(2, 95)],
      today
    );
    expect(warning?.date.getDate()).toBe(day(1).getDate());
  });

  it("se tait faute de prévision plutôt que d'inventer", () => {
    expect(sessionWeatherWarning([session(1)], null, today)).toBeNull();
    expect(sessionWeatherWarning([session(1)], [], today)).toBeNull();
    // Prévision disponible, mais pas pour ce jour-là.
    expect(sessionWeatherWarning([session(1)], [forecastFor(3, 61)], today)).toBeNull();
  });
});
