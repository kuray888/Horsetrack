import { describe, expect, it } from "vitest";
import { bucketByWeek, toCsv } from "@/lib/adminReports";

describe("inscriptions par semaine", () => {
  // Mercredi 28 octobre 2026, 10 h à Paris.
  const now = new Date("2026-10-28T09:00:00Z");

  it("compte par semaine du lundi au dimanche, semaine en cours en dernier", () => {
    const buckets = bucketByWeek(
      [
        new Date("2026-10-26T08:00:00Z"), // lundi de cette semaine
        new Date("2026-10-28T08:00:00Z"),
        new Date("2026-10-25T21:00:00Z"), // dimanche 22 h à Paris : semaine précédente
        new Date("2026-10-11T12:00:00Z"), // trois semaines avant
      ],
      4,
      now
    );
    expect(buckets.map((b) => b.weekStart)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 1, 2]);
  });

  it("suit l'heure de Paris : dimanche 23 h 30 à Paris reste dans la semaine finissante", () => {
    // 25 octobre 2026 : passage à l'heure d'hiver (UTC+1). 22 h 30 UTC = 23 h 30 à Paris.
    const [, last] = bucketByWeek([new Date("2026-10-25T22:30:00Z")], 2, now);
    expect(last.count).toBe(0);
    // 23 h 30 UTC = lundi 0 h 30 à Paris : semaine en cours.
    expect(bucketByWeek([new Date("2026-10-25T23:30:00Z")], 1, now)[0].count).toBe(1);
  });

  it("ignore ce qui sort de la fenêtre", () => {
    expect(bucketByWeek([new Date("2025-01-01T00:00:00Z")], 12, now).every((b) => b.count === 0)).toBe(true);
  });
});

describe("CSV de la console", () => {
  it("s'ouvre dans Excel en français : BOM, « ; », fins de ligne Windows", () => {
    const csv = toCsv(["Email", "Chevaux"], [["a@b.fr", 2]]);
    expect(csv).toBe("\uFEFFEmail;Chevaux\r\na@b.fr;2\r\n");
  });

  it("échappe les séparateurs, guillemets et retours à la ligne", () => {
    expect(toCsv(["x"], [['Dit "bonjour"; puis\npart']])).toBe('\uFEFFx\r\n"Dit ""bonjour""; puis\npart"\r\n');
  });

  it("neutralise les formules saisies par des tiers", () => {
    const csv = toCsv(["x"], [["=HYPERLINK(\"http://x\")"], ["+33 6 00"], ["-1"], ["@cmd"]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+33 6 00");
    expect(csv).toContain("'-1");
    expect(csv).toContain("'@cmd");
  });

  it("garde les nombres négatifs, dates et booléens lisibles", () => {
    expect(toCsv(["n", "d", "b"], [[-3, new Date("2026-10-28T00:00:00Z"), true]])).toBe(
      "\uFEFFn;d;b\r\n-3;2026-10-28 01:00;oui\r\n"
    );
  });
});
