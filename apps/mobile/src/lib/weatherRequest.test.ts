import { describe, expect, it } from "vitest";
import { coarsePosition, weatherApiPath } from "./weatherRequest";

describe("requête météo", () => {
  it("n'envoie qu'une position arrondie au kilomètre", () => {
    expect(coarsePosition(48.856613, 2.352222)).toEqual({ lat: 48.86, lon: 2.35 });
    expect(coarsePosition(-33.86882, 151.20929)).toEqual({ lat: -33.87, lon: 151.21 });
    expect(weatherApiPath(48.856613, 2.352222)).toBe("/api/weather?lat=48.86&lon=2.35");
  });
});
