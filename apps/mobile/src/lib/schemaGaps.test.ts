import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, unknown>();
vi.mock("@/lib/localStore", () => ({
  readJson: async (key: string, fallback: unknown) => (files.has(key) ? files.get(key) : fallback),
  writeJson: async (key: string, value: unknown) => {
    files.set(key, value);
    return true;
  },
}));

const { columnCaughtUp, columnState, noteColumnsRead, resetSchemaGapsForTests } = await import("@/lib/schemaGaps");

describe("colonnes ajoutées après coup", () => {
  beforeEach(() => {
    files.clear();
    resetSchemaGapsForTests();
  });

  it("jamais vue absente : rien à rattraper", async () => {
    expect(columnState("training_sessions", "activityKind")).toBe("present");
    await noteColumnsRead("training_sessions", ["activityKind"], true);
    expect(columnState("training_sessions", "activityKind")).toBe("present");
  });

  it("absente, puis créée : rattrapage une fois, puis plus rien", async () => {
    await noteColumnsRead("training_sessions", ["activityKind"], false);
    expect(columnState("training_sessions", "activityKind")).toBe("missing");
    await noteColumnsRead("training_sessions", ["activityKind"], true);
    expect(columnState("training_sessions", "activityKind")).toBe("catching_up");
    columnCaughtUp("training_sessions", "activityKind");
    expect(columnState("training_sessions", "activityKind")).toBe("present");
  });

  it("se souvient de l'absence après un redémarrage de l'app", async () => {
    await noteColumnsRead("journal_entries", ["activityKind", "videoPath"], false);
    resetSchemaGapsForTests();
    await noteColumnsRead("journal_entries", ["activityKind", "videoPath"], true);
    expect(columnState("journal_entries", "videoPath")).toBe("catching_up");
    expect(columnState("journal_entries", "activityKind")).toBe("catching_up");
    expect(columnState("training_sessions", "activityKind")).toBe("present");
  });
});
