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
  it("réglage du verrou illisible (trousseau fermé, app relancée écran verrouillé) : on revérifie, on n'ouvre pas", () => {
    expect(resolveGateStatus({ lockEnabled: "unknown", session: "present" })).toBe("checking");
    expect(resolveGateStatus({ lockEnabled: "unknown", session: "unknown" })).toBe("checking");
  });
  it("réglage illisible mais aucune session : rien à protéger, l'app s'ouvre", () => {
    expect(resolveGateStatus({ lockEnabled: "unknown", session: "absent" })).toBe("unlocked");
  });
});
