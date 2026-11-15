import { describe, expect, it } from "vitest";
import { resolveGateStatus } from "./biometricGateLogic";

describe("resolveGateStatus", () => {
  it("verrouille quand le verrou est actif et la session présente", () => {
    expect(resolveGateStatus({ lockEnabled: true, session: "present" })).toBe("locked");
  });
  it("reste verrouillé quand la session est illisible (jamais ouvert par une erreur)", () => {
    expect(resolveGateStatus({ lockEnabled: true, session: "unknown" })).toBe("locked");
  });
  it("s'ouvre sans verrou ou sans session", () => {
    expect(resolveGateStatus({ lockEnabled: false, session: "unknown" })).toBe("unlocked");
    expect(resolveGateStatus({ lockEnabled: true, session: "absent" })).toBe("unlocked");
  });
});
