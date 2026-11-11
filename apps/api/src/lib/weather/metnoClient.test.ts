import { describe, expect, it, vi } from "vitest";
import { createMetnoClient, MET_USER_AGENT } from "./metnoClient";

const BODY = {
  properties: {
    timeseries: [
      { time: "2026-11-12T10:00:00Z", data: { instant: { details: { air_temperature: 5 } }, next_1_hours: { summary: { symbol_code: "fair_day" } } } },
    ],
  },
};

function response(status: number, headers: Record<string, string>, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

describe("client MET Norway", () => {
  it("s'identifie, n'envoie que la position arrondie, et garde la réponse jusqu'à Expires", async () => {
    let now = Date.parse("2026-11-12T09:00:00Z");
    const fetchFn = vi.fn(async () =>
      response(200, { expires: "Thu, 12 Nov 2026 09:30:00 GMT", "last-modified": "Thu, 12 Nov 2026 08:55:00 GMT" }, BODY)
    );
    const client = createMetnoClient({ fetchFn, now: () => now });
    const first = await client.forecast(48.856613, 2.352222);
    expect(first?.hours).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=48.86&lon=2.35");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(MET_USER_AGENT);
    // Même kilomètre, avant Expires : aucun nouvel appel.
    now += 10 * 60_000;
    await client.forecast(48.8571, 2.3519);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(first?.maxAgeSeconds).toBe(30 * 60);
  });

  it("après Expires, redemande avec If-Modified-Since et garde les données sur un 304", async () => {
    let now = Date.parse("2026-11-12T09:00:00Z");
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(200, { expires: "Thu, 12 Nov 2026 09:30:00 GMT", "last-modified": "LM-1" }, BODY))
      .mockResolvedValueOnce(response(304, { expires: "Thu, 12 Nov 2026 10:30:00 GMT" }));
    const client = createMetnoClient({ fetchFn, now: () => now });
    await client.forecast(45, 5);
    now = Date.parse("2026-11-12T09:31:00Z");
    const again = await client.forecast(45, 5);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const init = fetchFn.mock.calls[1][1] as RequestInit;
    expect((init.headers as Record<string, string>)["If-Modified-Since"]).toBe("LM-1");
    expect(again?.hours).toHaveLength(1);
  });

  it("MET en panne : sert la dernière prévision connue, sinon null", async () => {
    let now = Date.parse("2026-11-12T09:00:00Z");
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(200, { expires: "Thu, 12 Nov 2026 09:30:00 GMT" }, BODY))
      .mockResolvedValueOnce(response(503, {}))
      .mockRejectedValueOnce(new Error("réseau"));
    const client = createMetnoClient({ fetchFn, now: () => now });
    await client.forecast(45, 5);
    now = Date.parse("2026-11-12T10:00:00Z");
    expect((await client.forecast(45, 5))?.hours).toHaveLength(1);
    expect(await client.forecast(10, 10)).toBeNull();
  });

  it("position invalide : null sans appel", async () => {
    const fetchFn = vi.fn();
    const client = createMetnoClient({ fetchFn, now: () => 0 });
    expect(await client.forecast(200, 0)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
