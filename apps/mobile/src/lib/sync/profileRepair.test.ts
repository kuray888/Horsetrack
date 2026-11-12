import { describe, expect, it, vi } from "vitest";
import { ensureServerRiderProfile, serverProfileNeedsRepair } from "./profileRepair";

describe("serverProfileNeedsRepair", () => {
  it("profil absent : à renvoyer", () => {
    expect(serverProfileNeedsRepair(null)).toBe(true);
  });

  it("profil sans onboardingCompletedAt : à renvoyer (pullCloudData l'ignore)", () => {
    expect(serverProfileNeedsRepair({ id: "p1", onboardingCompletedAt: null })).toBe(true);
  });

  it("profil complet : rien à faire", () => {
    expect(serverProfileNeedsRepair({ id: "p1", onboardingCompletedAt: "2026-10-01T10:00:00" })).toBe(false);
  });
});

describe("ensureServerRiderProfile", () => {
  it("renvoie le profil quand le serveur n'en a pas (envoi de fin d'onboarding perdu)", async () => {
    const pushProfile = vi.fn(async () => true);
    const outcome = await ensureServerRiderProfile({ readProfile: async () => null, pushProfile });
    expect(pushProfile).toHaveBeenCalledTimes(1);
    expect(outcome).toBe("repaired");
  });

  it("ne réécrit pas un profil complet", async () => {
    const pushProfile = vi.fn(async () => true);
    const outcome = await ensureServerRiderProfile({
      readProfile: async () => ({ id: "p1", onboardingCompletedAt: "2026-10-01T10:00:00" }),
      pushProfile,
    });
    expect(pushProfile).not.toHaveBeenCalled();
    expect(outcome).toBe("present");
  });

  it("une erreur de lecture n'est jamais prise pour « pas de profil »", async () => {
    const pushProfile = vi.fn(async () => true);
    const outcome = await ensureServerRiderProfile({
      readProfile: async () => {
        throw new Error("réseau");
      },
      pushProfile,
    });
    expect(pushProfile).not.toHaveBeenCalled();
    expect(outcome).toBe("unknown");
  });

  it("échec du renvoi : signalé, retenté à la relecture suivante", async () => {
    const outcome = await ensureServerRiderProfile({
      readProfile: async () => null,
      pushProfile: async () => {
        throw new Error("hors ligne");
      },
    });
    expect(outcome).toBe("failed");
  });
});
