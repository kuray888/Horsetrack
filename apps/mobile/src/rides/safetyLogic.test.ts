import { describe, expect, it } from "vitest";
import {
  ALERT_RETRY_MS,
  CHECK_TIMEOUT_MS,
  INITIAL_SAFETY_STATE,
  SNOOZE_MS,
  acknowledgeSafety,
  cleanContacts,
  evaluateSafety,
  retryAlert,
  shouldSendPosition,
  type SafetyState,
} from "@/rides/safetyLogic";

const T = 1_000_000;

function run(steps: { now: number; immobile: boolean; paused?: boolean }[], start: SafetyState = INITIAL_SAFETY_STATE) {
  let state = start;
  const log: string[] = [];
  for (const s of steps) {
    const r = evaluateSafety(state, { paused: false, ...s });
    state = r.state;
    log.push(...r.actions);
  }
  return { state, log };
}

describe("evaluateSafety", () => {
  it("immobile : vérification, puis alerte au bout de 2 min sans réponse", () => {
    const { log, state } = run([
      { now: T, immobile: true },
      { now: T + 60_000, immobile: true },
      { now: T + CHECK_TIMEOUT_MS, immobile: true },
    ]);
    expect(log).toEqual(["notify_check", "cancel_check", "send_alert"]);
    expect(state.alertSent).toBe(true);
  });

  it("n'alerte qu'une fois tant que le cavalier reste immobile", () => {
    const { log } = run([
      { now: T, immobile: true },
      { now: T + CHECK_TIMEOUT_MS, immobile: true },
      { now: T + CHECK_TIMEOUT_MS + 60_000, immobile: true },
      { now: T + 30 * 60_000, immobile: true },
    ]);
    expect(log.filter((a) => a === "send_alert")).toHaveLength(1);
  });

  it("repartir annule la vérification et réarme l'alerte", () => {
    const { log, state } = run([
      { now: T, immobile: true },
      { now: T + 30_000, immobile: false },
      { now: T + CHECK_TIMEOUT_MS, immobile: false },
    ]);
    expect(log).toEqual(["notify_check", "cancel_check"]);
    expect(state).toEqual({ ...INITIAL_SAFETY_STATE });
  });

  it("une séance en pause ne déclenche rien", () => {
    expect(run([{ now: T, immobile: true, paused: true }]).log).toEqual([]);
  });

  it("« Je vais bien » fait taire les vérifications 10 min", () => {
    const checking = run([{ now: T, immobile: true }]).state;
    const ack = acknowledgeSafety(checking, T + 30_000);
    expect(ack.actions).toEqual(["cancel_check"]);
    expect(run([{ now: T + 60_000, immobile: true }], ack.state).log).toEqual([]);
    expect(run([{ now: T + 30_000 + SNOOZE_MS, immobile: true }], ack.state).log).toEqual(["notify_check"]);
  });
});

describe("shouldSendPosition", () => {
  it("une position par minute", () => {
    expect(shouldSendPosition(0, T)).toBe(true);
    expect(shouldSendPosition(T, T + 30_000)).toBe(false);
    expect(shouldSendPosition(T, T + 60_000)).toBe(true);
  });
});

describe("cleanContacts", () => {
  it("garde 3 proches valides, sans doublon", () => {
    expect(
      cleanContacts([
        { name: " Maman ", email: "Maman@Exemple.fr" },
        { name: "Doublon", email: "maman@exemple.fr" },
        { name: "", email: "x@y.fr" },
        { name: "Sans email", email: "pas-un-email" },
        { name: "Papa", email: "papa@exemple.fr" },
        { name: "Coach", email: "coach@club.fr" },
        { name: "Quatrième", email: "q@x.fr" },
      ])
    ).toEqual([
      { name: "Maman", email: "maman@exemple.fr" },
      { name: "Papa", email: "papa@exemple.fr" },
      { name: "Coach", email: "coach@club.fr" },
    ]);
  });
});

describe("alerte qui n'a pas pu partir", () => {
  it("est rejouée après le délai, sans nouvelle notification, tant que le cavalier est immobile", () => {
    const now = 10_000_000;
    let state: SafetyState = { checkStartedAt: now - CHECK_TIMEOUT_MS, snoozeUntil: 0, alertSent: false };
    const first = evaluateSafety(state, { now, immobile: true, paused: false });
    expect(first.actions).toContain("send_alert");
    state = retryAlert(first.state, now);
    expect(state.alertSent).toBe(false);
    // Trop tôt : rien.
    expect(evaluateSafety(state, { now: now + 5_000, immobile: true, paused: false }).actions).toEqual([]);
    // Après le délai : seulement l'alerte, pas de notification « Tout va bien ? ».
    const again = evaluateSafety(state, { now: now + ALERT_RETRY_MS, immobile: true, paused: false });
    expect(again.actions).toEqual(["cancel_check", "send_alert"]);
  });
});
