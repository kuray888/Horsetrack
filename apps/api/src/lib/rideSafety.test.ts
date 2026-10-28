import { describe, expect, it } from "vitest";
import {
  alertEmail,
  allClearEmail,
  canSendAlert,
  generateShareToken,
  isShareToken,
  isViewable,
  minutesAgo,
  needsStaleAlert,
  parseContacts,
  shouldAutoEnd,
  startEmail,
  startSchema,
  staleEmail,
  updateSchema,
} from "@/lib/rideSafety";

const now = new Date("2026-10-27T13:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);
const share = (patch: Partial<Parameters<typeof needsStaleAlert>[0]> = {}) => ({
  status: "ACTIVE",
  startedAt: ago(60),
  lastPointAt: ago(1),
  alertSentAt: null,
  staleAlertSentAt: null,
  endedAt: null,
  ...patch,
});

describe("jeton", () => {
  it("fait 32 caractères sûrs pour une URL, et change à chaque fois", () => {
    const a = generateShareToken();
    expect(isShareToken(a)).toBe(true);
    expect(a).not.toBe(generateShareToken());
    expect(isShareToken("../admin")).toBe(false);
  });
});

describe("validation", () => {
  it("accepte 1 à 3 proches avec un email valide", () => {
    const ok = startSchema.safeParse({
      riderName: "Anis",
      horseName: "Éclair",
      contacts: [{ name: "Maman", email: " Maman@Exemple.fr " }],
    });
    expect(ok.success && ok.data.contacts[0].email).toBe("maman@exemple.fr");
    expect(startSchema.safeParse({ riderName: "A", horseName: "B", contacts: [] }).success).toBe(false);
    const four = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, email: `p${i}@x.fr` }));
    expect(startSchema.safeParse({ riderName: "A", horseName: "B", contacts: four }).success).toBe(false);
  });

  it("distingue position, alerte et fin", () => {
    expect(updateSchema.safeParse({ action: "position", lat: 47, lng: 2 }).success).toBe(true);
    expect(updateSchema.safeParse({ action: "position", lat: 200, lng: 2 }).success).toBe(false);
    expect(updateSchema.safeParse({ action: "alert", reason: "manual" }).success).toBe(true);
    expect(updateSchema.safeParse({ action: "alert", reason: "autre" }).success).toBe(false);
    expect(updateSchema.safeParse({ action: "end" }).success).toBe(true);
  });

  it("relit les proches stockés en ignorant un contenu illisible", () => {
    expect(parseContacts([{ name: "A", email: "a@b.fr" }])).toEqual([{ name: "A", email: "a@b.fr" }]);
    expect(parseContacts("n'importe quoi")).toEqual([]);
  });
});

describe("règles du serveur", () => {
  it("s'inquiète d'un téléphone muet depuis 15 min, une seule fois par silence", () => {
    expect(needsStaleAlert(share({ lastPointAt: ago(5) }), now)).toBe(false);
    expect(needsStaleAlert(share({ lastPointAt: ago(16) }), now)).toBe(true);
    expect(needsStaleAlert(share({ lastPointAt: ago(30), staleAlertSentAt: ago(10) }), now)).toBe(false);
    // Le téléphone a redonné signe de vie après l'alerte, puis s'est tu à nouveau.
    expect(needsStaleAlert(share({ lastPointAt: ago(20), staleAlertSentAt: ago(40) }), now)).toBe(true);
    expect(needsStaleAlert(share({ lastPointAt: null, startedAt: ago(20) }), now)).toBe(true);
    expect(needsStaleAlert(share({ status: "ENDED", lastPointAt: ago(60) }), now)).toBe(false);
  });

  it("clôt une balade oubliée après 12 h", () => {
    expect(shouldAutoEnd(share({ startedAt: ago(11 * 60) }), now)).toBe(false);
    expect(shouldAutoEnd(share({ startedAt: ago(12 * 60) }), now)).toBe(true);
  });

  it("espace les alertes d'au moins 10 min", () => {
    expect(canSendAlert(share(), now)).toBe(true);
    expect(canSendAlert(share({ alertSentAt: ago(3) }), now)).toBe(false);
    expect(canSendAlert(share({ alertSentAt: ago(11) }), now)).toBe(true);
    expect(canSendAlert(share({ status: "ENDED" }), now)).toBe(false);
  });

  it("garde le lien lisible 24 h après la fin", () => {
    expect(isViewable(share(), now)).toBe(true);
    expect(isViewable(share({ endedAt: ago(60) }), now)).toBe(true);
    expect(isViewable(share({ endedAt: ago(25 * 60) }), now)).toBe(false);
  });
});

describe("emails", () => {
  const ctx = { riderName: "Anis", horseName: "Éclair", viewUrl: "https://api.exemple.fr/suivi/abc" };

  it("donne le lien de suivi dès le départ", () => {
    const e = startEmail(ctx);
    expect(e.subject).toContain("Anis");
    expect(e.body).toContain("https://api.exemple.fr/suivi/abc");
  });

  it("l'alerte donne la dernière position et le 112", () => {
    const e = alertEmail({ ...ctx, reason: "immobile", lat: 47.123456, lng: 2.5, at: now });
    expect(e.subject).toMatch(/^Alerte/);
    expect(e.body).toContain("112");
    expect(e.body).toContain("query=47.123456,2.500000");
    expect(e.body).toContain("14:00");
  });

  it("neutralise un lien glissé dans un nom (hameçonnage)", () => {
    const e = startEmail({ ...ctx, riderName: "https://faux-site.com" });
    expect(e.subject).not.toContain("https://");
    expect(e.body).not.toContain("faux-site.com");
  });

  it("silence et fin de séance", () => {
    expect(staleEmail({ ...ctx, lat: null, lng: null, lastAt: ago(16) }).body).toContain("13:44");
    expect(allClearEmail(ctx).subject).toContain("terminé");
  });

  it("dit depuis quand", () => {
    expect(minutesAgo(ago(0), now)).toBe("à l'instant");
    expect(minutesAgo(ago(7), now)).toBe("il y a 7 min");
    expect(minutesAgo(ago(75), now)).toBe("il y a 1 h 15");
  });
});
