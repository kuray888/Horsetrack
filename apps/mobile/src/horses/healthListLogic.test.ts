import { describe, expect, it } from "vitest";
import { splitHealthHistory } from "./healthListLogic";

const today = new Date(2026, 10, 14);
const d = (day: number, month = 10) => ({ date: new Date(2026, month, day) });

describe("splitHealthHistory", () => {
  it("met le prochain soin en tête, puis l'historique du plus récent au plus ancien", () => {
    const { upcoming, past } = splitHealthHistory([d(1), d(30), d(13), d(20), d(14)], today);
    expect(upcoming.map((a) => a.date.getDate())).toEqual([20, 30]);
    expect(past.map((a) => a.date.getDate())).toEqual([14, 13, 1]);
  });

  it("un soin daté d'aujourd'hui compte comme fait", () => {
    expect(splitHealthHistory([d(14)], today).past).toHaveLength(1);
  });

  it("liste vide", () => {
    expect(splitHealthHistory([], today)).toEqual({ upcoming: [], past: [] });
  });
});
