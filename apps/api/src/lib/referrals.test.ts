import { describe, expect, it } from "vitest";
import {
  claimRefusal,
  generateReferralCode,
  isPaidConversionEvent,
  isReferralCodeFormat,
  normalizeReferralCode,
  rewardEndTime,
} from "@/lib/referrals";

const now = new Date("2026-10-27T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("codes", () => {
  it("6 caractères lisibles, sans 0/O ni 1/I", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(isReferralCodeFormat(code)).toBe(true);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it("tolère espaces, tirets et minuscules à la saisie", () => {
    expect(normalizeReferralCode(" ab3-k9z ")).toBe("AB3K9Z");
    expect(isReferralCodeFormat("AB3K9")).toBe(false);
  });
});

describe("claimRefusal", () => {
  const base = {
    refereeUserId: "u2",
    referrerUserId: "u1",
    refereeCreatedAt: daysAgo(3),
    alreadyReferred: false,
    everSubscribed: false,
    now,
  };

  it("accepte un nouveau compte jamais abonné", () => {
    expect(claimRefusal(base)).toBeNull();
  });

  it("refuse son propre code, un second parrain, un ancien abonné, un vieux compte", () => {
    expect(claimRefusal({ ...base, referrerUserId: "u2" })).toBe("own_code");
    expect(claimRefusal({ ...base, alreadyReferred: true })).toBe("already_referred");
    expect(claimRefusal({ ...base, everSubscribed: true })).toBe("already_subscriber");
    expect(claimRefusal({ ...base, refereeCreatedAt: daysAgo(31) })).toBe("too_old");
  });
});

describe("isPaidConversionEvent", () => {
  it("un essai ou un octroi offert ne récompense pas ; un paiement oui", () => {
    expect(isPaidConversionEvent({ type: "INITIAL_PURCHASE", period_type: "TRIAL" })).toBe(false);
    expect(isPaidConversionEvent({ type: "INITIAL_PURCHASE", period_type: "NORMAL" })).toBe(true);
    expect(isPaidConversionEvent({ type: "RENEWAL", period_type: "NORMAL" })).toBe(true);
    expect(isPaidConversionEvent({ type: "RENEWAL", store: "PROMOTIONAL" })).toBe(false);
    expect(isPaidConversionEvent({ type: "CANCELLATION" })).toBe(false);
  });
});

describe("rewardEndTime", () => {
  it("prolonge un accès en cours, sinon part de maintenant", () => {
    expect(rewardEndTime(null, now).toISOString()).toBe("2026-11-26T12:00:00.000Z");
    expect(rewardEndTime(new Date("2026-12-01T00:00:00Z"), now).toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(rewardEndTime(daysAgo(5), now).toISOString()).toBe("2026-11-26T12:00:00.000Z");
  });
});
