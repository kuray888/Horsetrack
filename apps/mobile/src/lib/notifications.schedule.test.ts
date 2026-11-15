(globalThis as { __DEV__?: boolean }).__DEV__ = false;
import { beforeEach, describe, expect, it, vi } from "vitest";

const n = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: n.schedule,
  getPermissionsAsync: async () => ({ status: "granted", granted: true }),
  requestPermissionsAsync: async () => ({ status: "granted", granted: true }),
  setNotificationChannelAsync: async () => {},
  setNotificationHandler: () => {},
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { scheduleReminder } from "./notifications";

describe("scheduleReminder", () => {
  beforeEach(() => {
    n.schedule.mockReset();
    n.schedule.mockResolvedValue("id1");
  });

  it("ne programme rien pour un rappel dans le passé", async () => {
    expect(await scheduleReminder("t", "b", new Date(Date.now() - 60_000))).toBeNull();
    expect(n.schedule).not.toHaveBeenCalled();
  });

  it("programme un rappel futur", async () => {
    expect(await scheduleReminder("t", "b", new Date(Date.now() + 3_600_000))).toBe("id1");
  });

  it("renvoie null au lieu de lever si iOS refuse", async () => {
    n.schedule.mockRejectedValue(new Error("trigger invalide"));
    expect(await scheduleReminder("t", "b", new Date(Date.now() + 3_600_000))).toBeNull();
  });
});
