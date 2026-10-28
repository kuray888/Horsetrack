import { describe, expect, it } from "vitest";
import {
  acceptPoint,
  activeSeconds,
  classifyGait,
  currentSpeedKmh,
  decodePolyline,
  downsample,
  encodePolyline,
  formatClock,
  formatDistance,
  haversineMeters,
  isImmobile,
  projectRoute,
  summarizeRide,
  type RidePoint,
} from "@/rides/rideMath";

const M_PER_DEG_LAT = 111_195;
const T0 = Date.UTC(2026, 9, 27, 9, 0, 0);

/** Trajet plein nord, un point toutes les `stepS` secondes, à `kmh` constants. */
function straight(kmh: number, seconds: number, opts: { from?: RidePoint; stepS?: number; doppler?: boolean } = {}) {
  const stepS = opts.stepS ?? 5;
  const start = opts.from ?? { t: T0, lat: 47.0, lng: 2.0, acc: 5, speed: null };
  const points: RidePoint[] = opts.from ? [] : [start];
  const mPerStep = (kmh / 3.6) * stepS;
  for (let i = 1; i <= seconds / stepS; i++) {
    points.push({
      t: start.t + i * stepS * 1000,
      lat: start.lat + (mPerStep * i) / M_PER_DEG_LAT,
      lng: start.lng,
      acc: 5,
      speed: opts.doppler === false ? null : kmh / 3.6,
    });
  }
  return points;
}

describe("allures", () => {
  it("classe selon la vitesse", () => {
    expect(classifyGait(0.5)).toBe("halt");
    expect(classifyGait(6)).toBe("walk");
    expect(classifyGait(12)).toBe("trot");
    expect(classifyGait(22)).toBe("canter");
  });
});

describe("haversineMeters", () => {
  it("donne ~111 km pour un degré de latitude", () => {
    expect(haversineMeters({ lat: 47, lng: 2 }, { lat: 48, lng: 2 })).toBeCloseTo(M_PER_DEG_LAT, -2);
  });
});

describe("acceptPoint", () => {
  const p = { t: T0, lat: 47, lng: 2, acc: 5, speed: null };
  it("rejette les points imprécis, rétrogrades ou téléportés", () => {
    expect(acceptPoint(null, p)).toBe(true);
    expect(acceptPoint(null, { ...p, acc: 80 })).toBe(false);
    expect(acceptPoint(p, { ...p, t: T0 - 1000 })).toBe(false);
    // 1 km en 5 s = 720 km/h.
    expect(acceptPoint(p, { ...p, t: T0 + 5000, lat: 47 + 1000 / M_PER_DEG_LAT })).toBe(false);
    expect(acceptPoint(p, { ...p, t: T0 + 5000, lat: 47 + 15 / M_PER_DEG_LAT })).toBe(true);
  });
});

describe("summarizeRide", () => {
  it("additionne distance et temps par allure", () => {
    const walk = straight(6, 600);
    const trot = straight(13, 300, { from: walk[walk.length - 1] });
    const canter = straight(22, 120, { from: trot[trot.length - 1] });
    const points = [...walk, ...trot, ...canter];
    const stats = summarizeRide(points, [], T0, points[points.length - 1].t);
    expect(stats.durationSeconds).toBe(1020);
    expect(stats.gaitSeconds).toEqual({ halt: 0, walk: 600, trot: 300, canter: 120 });
    // 1 000 m au pas + ~1 083 m au trot + ~733 m au galop.
    expect(stats.distanceMeters).toBeGreaterThan(2780);
    expect(stats.distanceMeters).toBeLessThan(2850);
    expect(stats.maxSpeedKmh).toBeCloseTo(22, 0);
    expect(stats.avgSpeedKmh).toBeCloseTo(9.9, 0);
  });

  it("sans vitesse Doppler, la déduit des positions", () => {
    const points = straight(12, 300, { doppler: false });
    const stats = summarizeRide(points, [], T0, points[points.length - 1].t);
    expect(stats.gaitSeconds.trot).toBe(300);
  });

  it("n'ajoute pas de distance quand le cheval est arrêté (bruit GPS)", () => {
    const points: RidePoint[] = Array.from({ length: 60 }, (_, i) => ({
      t: T0 + i * 5000,
      lat: 47 + ((i % 2) * 1.5) / M_PER_DEG_LAT,
      lng: 2,
      acc: 8,
      speed: 0.1,
    }));
    const stats = summarizeRide(points, [], T0, points[points.length - 1].t);
    expect(stats.distanceMeters).toBe(0);
    expect(stats.gaitSeconds.halt).toBe(295);
  });

  it("ne compte ni le temps ni la distance des pauses", () => {
    const points = straight(6, 600);
    const pause = { start: T0 + 200_000, end: T0 + 400_000 };
    const stats = summarizeRide(points, [pause], T0, points[points.length - 1].t);
    expect(stats.durationSeconds).toBe(400);
    expect(stats.gaitSeconds.walk).toBe(400);
    expect(stats.distanceMeters).toBeCloseTo(667, -1);
  });

  it("compte à l'arrêt le temps sans GPS, pour que les allures fassent la durée", () => {
    const stats = summarizeRide([], [], T0, T0 + 1800_000);
    expect(stats.durationSeconds).toBe(1800);
    expect(stats.gaitSeconds.halt).toBe(1800);
    expect(stats.distanceMeters).toBe(0);
  });
});

describe("activeSeconds", () => {
  it("retire les pauses, y compris celle en cours", () => {
    expect(activeSeconds(T0, [{ start: T0 + 60_000, end: null }], T0 + 120_000)).toBe(60);
  });
});

describe("currentSpeedKmh", () => {
  it("ignore un point aberrant isolé", () => {
    const points = straight(6, 20);
    points[points.length - 2] = { ...points[points.length - 2], speed: 30 / 3.6 };
    expect(currentSpeedKmh(points)).toBeCloseTo(6, 0);
  });
});

describe("isImmobile", () => {
  it("détecte 5 minutes sur place, pas une séance qui vient de commencer", () => {
    const still: RidePoint[] = Array.from({ length: 70 }, (_, i) => ({
      t: T0 + i * 5000,
      lat: 47 + ((i % 3) * 3) / M_PER_DEG_LAT,
      lng: 2,
      acc: 8,
      speed: 0,
    }));
    const now = still[still.length - 1].t;
    expect(isImmobile(still, now, T0)).toBe(true);
    expect(isImmobile(still, now, now - 60_000)).toBe(false);
  });

  it("un cavalier qui avance n'est pas immobile", () => {
    const points = straight(6, 600);
    expect(isImmobile(points, points[points.length - 1].t, T0)).toBe(false);
  });

  it("sans point récent (GPS perdu), ne conclut rien", () => {
    const points = straight(0, 60);
    expect(isImmobile(points, T0 + 30 * 60_000, T0)).toBe(false);
  });
});

describe("tracé", () => {
  it("encode et décode une polyligne sans perte au 1e-5", () => {
    const coords = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    const encoded = encodePolyline(coords);
    expect(encoded).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(decodePolyline(encoded)).toEqual(coords);
  });

  it("réduit le nombre de points en gardant le premier et le dernier", () => {
    const list = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(list, 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe(0);
    expect(out[9]).toBe(999);
  });

  it("projette le tracé dans le cadre, nord en haut", () => {
    const pts = projectRoute(
      [
        { lat: 47, lng: 2 },
        { lat: 47.001, lng: 2 },
      ],
      100,
      100
    );
    expect(pts[0].y).toBeGreaterThan(pts[1].y);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
});

describe("affichage", () => {
  it("formate chrono et distance", () => {
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(4230)).toBe("4,23 km");
    expect(formatDistance(12_340)).toBe("12,3 km");
  });
});
