import { describe, expect, it } from "vitest";
import { canTrigger, notificationKey, planningMessage, planningPushMessages, planningRecipients, whenLabel } from "./planningPush";

const team = [
  { userId: "owner", role: "OWNER" },
  { userId: "dp", role: "DEMI_PENSION" },
  { userId: "coach", role: "COACH" },
  { userId: "groom", role: "GROOM" },
];

describe("canTrigger", () => {
  const base = { callerId: "owner", callerRole: "OWNER", createdByUserId: null, doneByUserId: null };

  it("un ancien partage (LEGACY) garde le droit d'attribuer, d'annuler et d'annoncer un créneau", () => {
    const legacy = { ...base, callerId: "old", callerRole: "LEGACY" };
    expect(canTrigger("assigned", legacy)).toBe(true);
    expect(canTrigger("cancelled", legacy)).toBe(true);
    expect(canTrigger("slot_assigned", legacy)).toBe(true);
  });

  it("un ancien partage ne reçoit pas les « a monté » (rien de nouveau pour lui)", () => {
    const t = [...team, { userId: "old", role: "LEGACY" }];
    expect(planningRecipients("done", { callerId: "dp", riderUserId: "dp", team: t })).not.toContain("old");
  });
  it("attribuer : qui organise le planning, ou l'auteur de la séance", () => {
    expect(canTrigger("assigned", base)).toBe(true);
    expect(canTrigger("assigned", { ...base, callerId: "dp", callerRole: "DEMI_PENSION" })).toBe(false);
    expect(canTrigger("assigned", { ...base, callerId: "dp", callerRole: "DEMI_PENSION", createdByUserId: "dp" })).toBe(true);
  });
  it("« a monté » : seulement celui qui a vraiment coché", () => {
    expect(canTrigger("done", { ...base, callerId: "dp", callerRole: "DEMI_PENSION", doneByUserId: "dp" })).toBe(true);
    expect(canTrigger("done", { ...base, callerId: "dp", callerRole: "DEMI_PENSION", doneByUserId: "owner" })).toBe(false);
  });
  it("hors de l'équipe : rien", () => {
    expect(canTrigger("assigned", { ...base, callerRole: null })).toBe(false);
  });
});

describe("planningRecipients", () => {
  it("attribution : le cavalier, jamais soi-même", () => {
    expect(planningRecipients("assigned", { callerId: "owner", riderUserId: "dp", team })).toEqual(["dp"]);
    expect(planningRecipients("assigned", { callerId: "dp", riderUserId: "dp", team })).toEqual([]);
  });
  it("« a monté » : propriétaire, gérant et coach, pas le groom", () => {
    expect(planningRecipients("done", { callerId: "dp", riderUserId: "dp", team })).toEqual(["owner", "coach"]);
  });
  it("jamais quelqu'un hors de l'équipe", () => {
    expect(planningRecipients("assigned", { callerId: "owner", riderUserId: "parti", team })).toEqual([]);
  });
});

describe("messages", () => {
  it("français et anglais, sans emoji", () => {
    expect(planningMessage("done", "fr", { who: "Léa", horseName: "Tornade", when: "mardi 10/11", feeling: "GOOD" })).toEqual({
      title: "Léa a monté Tornade",
      body: "mardi 10/11 · bonne séance.",
    });
    expect(planningMessage("assigned", "en", { who: "Camille", horseName: "Tornade", when: "Tuesday 10/11 at 18:00" }).title).toBe(
      "You're riding Tornade"
    );
  });
  it("date au fuseau de Paris", () => {
    // Minuit à Paris le mardi 10/11 = 23 h UTC le lundi.
    expect(whenLabel(new Date("2026-11-09T23:00:00Z"), "18:00", "fr")).toBe("mardi 10/11 à 18:00");
    expect(whenLabel(new Date("2026-11-09T23:00:00Z"), null, "en")).toBe("Tuesday 10/11");
  });
  it("jetons Expo seulement, langue de chaque appareil", () => {
    const msgs = planningPushMessages(
      "assigned",
      [
        { token: "ExponentPushToken[abcdefghijkl]", userId: "dp", lang: "en" },
        { token: "pas-un-jeton", userId: "dp", lang: "fr" },
      ],
      "/planning-semaine",
      () => ({ who: "Camille", horseName: "Tornade", when: "mardi" })
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].title).toBe("You're riding Tornade");
  });
  it("clé de déduplication stable", () => {
    expect(notificationKey("session", "s1", "done", "owner")).toBe("session:s1:done:owner");
  });
});
