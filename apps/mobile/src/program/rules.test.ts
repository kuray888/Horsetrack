import { describe, it, expect } from "vitest";
import { generateProgram } from "./rules";
import type { RiderProfile } from "@/rider/store";
import type { Horse, Injury } from "@/horses/store";

function makeRider(overrides: Partial<RiderProfile> = {}): RiderProfile {
  return {
    level: "AMATEUR",
    mainDiscipline: "SHOW_JUMPING",
    rideFrequency: "DAILY",
    preferredTime: null,
    primaryGoal: null,
    additionalInfo: "",
    ...overrides,
  };
}

function makeInjury(overrides: Partial<Injury> = {}): Injury {
  return {
    id: "inj1",
    type: "Tendinite",
    occurredAt: null,
    recoveryStatus: null,
    note: "",
    ...overrides,
  };
}

function makeHorse(overrides: Partial<Horse> = {}): Horse {
  return {
    id: "h1",
    name: "Tornado",
    emoji: "🐴",
    photoUrl: null,
    birthYear: 2015,
    sex: "GELDING",
    breed: null,
    heightCm: 165,
    weightKg: 550,
    discipline: "SHOW_JUMPING",
    level: "PRO",
    fitnessLevel: "PEAK",
    workload: "DAILY",
    isPrimary: true,
    strengths: [],
    weaknesses: [],
    temperament: [],
    healthConditions: [],
    restDayActivities: [],
    injuries: [],
    sharedRole: null,
    ...overrides,
  };
}

function allSessionTypes(program: ReturnType<typeof generateProgram>) {
  return program.weeks.flatMap((w) => w.sessions.map((s) => s.type));
}

function sessionsOfWeek(program: ReturnType<typeof generateProgram>, weekNumber: number) {
  return program.weeks.find((w) => w.weekNumber === weekNumber)!.sessions;
}

describe("generateProgram — safety ceiling vs. AFFIRMATION ramp-up", () => {
  // PRO rider + PRO horse + PEAK fitness => unrestricted base intensity is
  // HIGH (cf. computeBaseIntensity). COMPETE goal puts week 8 (of 8) in the
  // AFFIRMATION phase, which is supposed to ramp intensity UP by one notch.
  const eliteRider = makeRider({ level: "PRO", primaryGoal: "COMPETE" });
  const eliteHorse = makeHorse({ level: "PRO", fitnessLevel: "PEAK", discipline: "SHOW_JUMPING" });

  it("never exceeds a health-condition intensity cap, even in the AFFIRMATION phase", () => {
    const horse = makeHorse({ ...eliteHorse, healthConditions: ["Arthrose"] }); // maxIntensity: MEDIUM
    const program = generateProgram(eliteRider, horse);

    const week8 = sessionsOfWeek(program, 8);
    expect(week8.length).toBeGreaterThan(0);
    for (const session of week8) {
      expect(session.intensity).not.toBe("HIGH");
    }
  });

  it("never schedules an excluded session type (OBSTACLE) for a horse with Arthrose", () => {
    const horse = makeHorse({ ...eliteHorse, healthConditions: ["Arthrose"] });
    const program = generateProgram(eliteRider, horse);
    expect(allSessionTypes(program)).not.toContain("OBSTACLE");
  });

  it("caps intensity to LOW for an actively-recovering injury, even in AFFIRMATION", () => {
    const horse = makeHorse({
      ...eliteHorse,
      injuries: [makeInjury({ type: "Tendinite", recoveryStatus: "IN_PROGRESS" })],
    });
    const program = generateProgram(eliteRider, horse);

    const week8 = sessionsOfWeek(program, 8);
    for (const session of week8) {
      expect(session.intensity).toBe("LOW");
    }
  });

  it("excludes jumping work for an active musculoskeletal injury", () => {
    const horse = makeHorse({
      ...eliteHorse,
      injuries: [makeInjury({ type: "Tendinite", recoveryStatus: "IN_PROGRESS" })],
    });
    const program = generateProgram(eliteRider, horse);
    const types = allSessionTypes(program);
    expect(types).not.toContain("OBSTACLE");
    expect(types).not.toContain("BARRES_AU_SOL");
  });

  it("still ramps an unrestricted pairing up to HIGH in the AFFIRMATION phase (regression guard)", () => {
    // AMATEUR rider + CLUB horse + GOOD fitness => base intensity MEDIUM,
    // no health/injury restriction => AFFIRMATION should reach HIGH.
    const rider = makeRider({ level: "AMATEUR", primaryGoal: "COMPETE" });
    const horse = makeHorse({ level: "CLUB", fitnessLevel: "GOOD", healthConditions: [], injuries: [] });
    const program = generateProgram(rider, horse);

    const week8 = sessionsOfWeek(program, 8);
    expect(week8.some((s) => s.intensity === "HIGH")).toBe(true);
  });
});

function jumpHeightsCm(program: ReturnType<typeof generateProgram>): number[] {
  const heights: number[] = [];
  for (const week of program.weeks) {
    for (const session of week.sessions) {
      if (session.type !== "OBSTACLE") continue;
      for (const note of session.setupNotes) {
        const match = /Hauteur indicative : ~(\d+) cm/.exec(note);
        if (match) heights.push(Number(match[1]));
      }
    }
  }
  return heights;
}

describe("generateProgram — jump height stays within level-appropriate bounds", () => {
  // Safety-relevant constants (JUMP_HEIGHT_RANGE_CM) — a regression here means
  // an UNTRAINED horse could get programmed jump heights meant for a PRO one.
  const rider = makeRider({ level: "PRO", primaryGoal: "COMPETE" });

  it("keeps an UNTRAINED horse's jump heights within [20, 40] cm", () => {
    const horse = makeHorse({ level: "UNTRAINED", discipline: "SHOW_JUMPING", fitnessLevel: "PEAK" });
    const heights = jumpHeightsCm(generateProgram(rider, horse));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(20);
      expect(h).toBeLessThanOrEqual(40);
    }
  });

  it("keeps a PRO horse's jump heights within [100, 120] cm", () => {
    const horse = makeHorse({ level: "PRO", discipline: "SHOW_JUMPING", fitnessLevel: "PEAK" });
    const heights = jumpHeightsCm(generateProgram(rider, horse));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(100);
      expect(h).toBeLessThanOrEqual(120);
    }
  });

  it("never lets a higher horse level produce a lower max jump height than a lower level", () => {
    const levels: ["UNTRAINED" | "CLUB" | "AMATEUR" | "PRO", number][] = [
      ["UNTRAINED", 0],
      ["CLUB", 0],
      ["AMATEUR", 0],
      ["PRO", 0],
    ];
    const maxByLevel = levels.map(([level]) => {
      const horse = makeHorse({ level, discipline: "SHOW_JUMPING", fitnessLevel: "PEAK" });
      return Math.max(...jumpHeightsCm(generateProgram(rider, horse)));
    });
    for (let i = 1; i < maxByLevel.length; i++) {
      expect(maxByLevel[i]).toBeGreaterThanOrEqual(maxByLevel[i - 1]);
    }
  });
});

describe("generateProgram — session frequency", () => {
  it("caps sessions per week at 2 when the horse is RESTING, regardless of rider availability", () => {
    const rider = makeRider({ rideFrequency: "DAILY" });
    const horse = makeHorse({ fitnessLevel: "RESTING", workload: "DAILY" });
    const program = generateProgram(rider, horse);

    expect(program.sessionsPerWeek).toBeLessThanOrEqual(2);
    expect(program.safetyNotes.some((n) => n.includes("repos"))).toBe(true);
  });

  it("never schedules zero sessions per week", () => {
    const rider = makeRider({ rideFrequency: "OCCASIONAL" });
    const horse = makeHorse({ workload: "NONE", fitnessLevel: "RESTING" });
    const program = generateProgram(rider, horse);
    expect(program.sessionsPerWeek).toBeGreaterThanOrEqual(1);
  });
});
