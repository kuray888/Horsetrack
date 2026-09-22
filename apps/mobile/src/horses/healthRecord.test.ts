import { describe, expect, it } from "vitest";
import { buildHealthRecordLines, type RecordAppointment, type RecordHorse } from "@/horses/healthRecord";

const today = new Date(2026, 8, 22);

const horse = (over: Partial<RecordHorse> = {}): RecordHorse => ({
  name: "Bella",
  birthYear: 2015,
  sex: "MARE",
  breed: "Selle Français",
  coat: "Baie",
  heightCm: 165,
  weightKg: 520,
  healthConditions: [],
  injuries: [],
  ...over,
});

const soin = (over: Partial<RecordAppointment> = {}): RecordAppointment => ({
  type: "veto",
  typeLabel: "Vétérinaire",
  title: "Vaccin grippe",
  date: new Date(2026, 5, 10),
  professional: "Dr Martin",
  nextDueDate: new Date(2027, 5, 10),
  notes: "",
  ...over,
});

const textOf = (lines: { style: string; text?: string }[]) => lines.map((l) => l.text ?? "").join("\n");

describe("buildHealthRecordLines", () => {
  it("met le cheval et la date d'établissement en tête", () => {
    const text = textOf(buildHealthRecordLines(horse(), [], [], today));
    expect(text).toContain("Carnet de santé — Bella");
    expect(text).toContain("22/09/2026");
  });

  it("reprend l'identité renseignée, et seulement elle", () => {
    const text = textOf(buildHealthRecordLines(horse({ breed: null, coat: null }), [], [], today));
    expect(text).toContain("Né en 2015 (11 ans)");
    expect(text).toContain("165 cm au garrot");
    expect(text).not.toContain("Robe");
  });

  it("classe les soins du plus récent au plus ancien", () => {
    const lines = buildHealthRecordLines(
      horse(),
      [soin({ title: "Ancien", date: new Date(2025, 0, 5) }), soin({ title: "Récent", date: new Date(2026, 7, 1) })],
      [],
      today
    );
    const text = textOf(lines);
    expect(text.indexOf("Récent")).toBeLessThan(text.indexOf("Ancien"));
  });

  it("joint le professionnel et la prochaine échéance au soin", () => {
    const text = textOf(buildHealthRecordLines(horse(), [soin()], [], today));
    expect(text).toContain("Vaccin grippe");
    expect(text).toContain("Dr Martin");
    expect(text).toContain("prochaine échéance 10/06/2027");
  });

  it("dit qu'il n'y a rien de NOTÉ, pas qu'il n'y a rien eu", () => {
    // Un carnet vide ne prouve pas qu'un cheval n'a jamais rien eu : le
    // lecteur (véto, acheteur) doit pouvoir faire la différence.
    const text = textOf(buildHealthRecordLines(horse(), [], [], today));
    expect(text).toContain("Aucun antécédent noté dans l'application");
    expect(text).toContain("Aucun soin enregistré dans l'application");
  });

  it("reporte les antécédents et l'état des blessures", () => {
    const text = textOf(
      buildHealthRecordLines(
        horse({
          healthConditions: ["Arthrose débutante"],
          injuries: [
            { type: "Tendinite", occurredAt: new Date(2026, 2, 3), recovered: true, note: "" },
            { type: "Abcès", occurredAt: new Date(2026, 7, 9), recovered: false, note: "Pied antérieur droit" },
          ],
        }),
        [],
        [],
        today
      )
    );
    expect(text).toContain("Arthrose débutante");
    expect(text).toContain("Tendinite — 03/03/2026 (rétabli)");
    expect(text).toContain("Abcès — 09/08/2026 (en cours)");
    expect(text).toContain("Pied antérieur droit");
  });

  it("limite le suivi du poids à ce qui se lit encore", () => {
    const weights = Array.from({ length: 20 }, (_, i) => ({ date: new Date(2026, 8, 1 + i), weightKg: 500 + i }));
    const text = textOf(buildHealthRecordLines(horse(), [], weights, today));
    // Seules les lignes de pesée (« date — poids »), pas le poids courant
    // qui figure aussi dans l'identité.
    expect((text.match(/^\d{2}\/\d{2}\/\d{4} — \d+ kg$/gm) ?? []).length).toBe(12);
    // Le plus récent en premier.
    expect(text).toContain("20/09/2026 — 519 kg");
  });

  it("rappelle que le document ne remplace pas les papiers officiels", () => {
    const text = textOf(buildHealthRecordLines(horse(), [], [], today));
    expect(text).toContain("ne remplace pas les documents officiels");
  });
});
