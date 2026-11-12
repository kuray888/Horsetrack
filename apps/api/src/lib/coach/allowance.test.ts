import { describe, expect, it } from "vitest";
import { FREE_QUESTIONS, questionAllowance } from "./allowance";
import { QUOTAS } from "./config";

describe("questions au coach : Premium ou questions offertes", () => {
  it("Premium : le quota du mois, comme avant", () => {
    expect(questionAllowance({ quotas: QUOTAS, usedThisMonth: 4, usedEver: 50 })).toEqual({ allowed: true, left: 26, free: false });
    expect(questionAllowance({ quotas: QUOTAS, usedThisMonth: 30, usedEver: 50 })).toEqual({ allowed: false, left: 0, free: false });
  });

  it("gratuit : 3 questions offertes en tout, pas par mois", () => {
    expect(FREE_QUESTIONS).toBe(3);
    expect(questionAllowance({ quotas: null, usedThisMonth: 0, usedEver: 0 })).toEqual({ allowed: true, left: 3, free: true });
    expect(questionAllowance({ quotas: null, usedThisMonth: 0, usedEver: 2 })).toEqual({ allowed: true, left: 1, free: true });
    expect(questionAllowance({ quotas: null, usedThisMonth: 0, usedEver: 3 })).toEqual({ allowed: false, left: 0, free: true });
  });

  it("un ancien abonné a déjà utilisé ses questions offertes", () => {
    expect(questionAllowance({ quotas: null, usedThisMonth: 0, usedEver: 12 })).toEqual({ allowed: false, left: 0, free: true });
  });
});
