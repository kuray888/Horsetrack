import { describe, expect, it } from "vitest";
import { MAX_EVENT_SPAN_DAYS, daysCovered, defaultInternationalEnd, lastDayOf } from "./eventSpan";

const d = (y: number, m: number, day: number, h = 0) => new Date(y, m - 1, day, h);

describe("lastDayOf", () => {
  it("sans date de fin, le dernier jour est le jour de début", () => {
    expect(lastDayOf(d(2026, 10, 12, 9), null)).toEqual(d(2026, 10, 12));
  });

  it("une date de fin antérieure au début est ignorée", () => {
    expect(lastDayOf(d(2026, 10, 12), d(2026, 10, 10))).toEqual(d(2026, 10, 12));
  });

  it("ignore l'heure", () => {
    expect(lastDayOf(d(2026, 10, 12, 18), d(2026, 10, 15, 2))).toEqual(d(2026, 10, 15));
  });
});

describe("daysCovered", () => {
  it("un jour seul", () => {
    expect(daysCovered(d(2026, 10, 12), null)).toEqual([d(2026, 10, 12)]);
  });

  it("un concours de 4 jours à cheval sur deux mois", () => {
    expect(daysCovered(d(2026, 10, 30), d(2026, 11, 2))).toEqual([
      d(2026, 10, 30),
      d(2026, 10, 31),
      d(2026, 11, 1),
      d(2026, 11, 2),
    ]);
  });

  it("plafonne une date de fin aberrante", () => {
    expect(daysCovered(d(2026, 1, 1), d(2027, 1, 1))).toHaveLength(MAX_EVENT_SPAN_DAYS);
  });
});

describe("defaultInternationalEnd", () => {
  it("donne un événement de 4 jours", () => {
    expect(daysCovered(d(2026, 10, 12), defaultInternationalEnd(d(2026, 10, 12)))).toHaveLength(4);
  });
});
