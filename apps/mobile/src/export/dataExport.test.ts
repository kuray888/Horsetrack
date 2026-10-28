import { describe, expect, it } from "vitest";
import { buildZip, crc32, utf8 } from "@/export/zip";
import {
  buildExportFiles,
  buildExportZip,
  exportFileName,
  formatCell,
  toCsv,
  type ExportData,
  type ExportLabels,
} from "@/export/dataExport";

const labels: ExportLabels = {
  activity: { dressage: "Dressage", balade: "Balade" },
  mood: { great: "Top" },
  appointmentType: { veto: "Vétérinaire", concours: "Concours" },
  expenseCategory: { pension: "Pension" },
  documentCategory: { facture: "Facture" },
  horseSex: { MARE: "Jument" },
  horseLevel: { CLUB: "Niveau club" },
  discipline: { DRESSAGE: "Dressage", SHOW_JUMPING: "Saut d'obstacles (CSO)" },
  intensity: { medium: "Moyenne" },
  goalType: { COMPETE: "Progresser en concours" },
  sharedRole: { DEMI_PENSION: "Demi-pension" },
  recoveryStatus: { RECOVERED: "Guéri" },
};

const d = (s: string) => new Date(`${s}T00:00:00`);

const data: ExportData = {
  horses: [
    {
      id: "h1",
      name: "Éclair",
      birthYear: 2015,
      sex: "MARE",
      breed: "Selle Français",
      coat: "Bai",
      heightCm: 165,
      weightKg: 540,
      discipline: "DRESSAGE",
      level: "CLUB",
      healthConditions: ["Arthrose"],
      injuries: [{ type: "Tendinite", occurredAt: d("2025-03-02"), recoveryStatus: "RECOVERED", note: "" }],
      sharedRole: null,
    },
    {
      id: "h2",
      name: "Pépite",
      birthYear: null,
      sex: null,
      breed: null,
      coat: null,
      heightCm: null,
      weightKg: null,
      discipline: null,
      level: null,
      healthConditions: [],
      injuries: [],
      sharedRole: "DEMI_PENSION",
    },
  ],
  sessions: [
    {
      horseId: "h1",
      date: d("2026-10-20"),
      time: "18:00",
      activityType: "dressage",
      customActivityLabel: null,
      durationMinutes: 45,
      intensity: "medium",
      completed: true,
      notes: 'Travail des "épaules en dedans"; très bien',
    },
    {
      horseId: "h1",
      date: d("2026-10-10"),
      time: "",
      activityType: "balade",
      customActivityLabel: "Travail à pied",
      durationMinutes: null,
      intensity: null,
      completed: false,
      notes: "",
    },
  ],
  appointments: [
    {
      horseId: "h1",
      type: "concours",
      title: "CSO Lamotte",
      date: d("2026-11-01"),
      endDate: null,
      time: "",
      location: "Lamotte",
      professional: null,
      cost: 85.5,
      nextDueDate: null,
      result: null,
      dossard: "112",
      competitionLevel: "national",
      notes: "",
      competitionEntries: [{ name: "Club 2", discipline: "SHOW_JUMPING", time: "10:30", result: "3e" }],
    },
  ],
  journal: [
    {
      horseId: "h2",
      date: d("2026-10-01"),
      time: "09:00",
      activityType: "balade",
      mood: "great",
      notes: "=1+1",
      weather: { tempC: 14.6, label: "Ensoleillé" },
      photoUri: "file:///x.jpg",
    },
  ],
  expenses: [
    { horseId: "h1", date: d("2026-10-05"), category: "pension", amount: 420.5, currency: "EUR", isPaid: true, notes: "" },
  ],
  weights: [{ horseId: "h1", date: d("2026-09-01"), weightKg: 538 }],
  documents: [{ horseId: "h1", date: d("2026-09-15"), category: "facture", name: "Facture véto" }],
  goals: [{ title: "Club 1", type: "COMPETE", customType: null, targetDate: d("2027-06-01"), horseId: "h1" }],
};

/** Relit une archive « stored » via son répertoire central — de quoi vérifier
 * l'archive comme le ferait un vrai outil, sans dépendance. */
function readZip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endPos = bytes.length - 22;
  expect(view.getUint32(endPos, true)).toBe(0x06054b50);
  const count = view.getUint16(endPos + 10, true);
  let pos = view.getUint32(endPos + 16, true);
  const decoder = new TextDecoder();
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(pos, true)).toBe(0x02014b50);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const offset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const localNameLen = view.getUint16(offset + 26, true);
    const content = bytes.subarray(offset + 30 + localNameLen, offset + 30 + localNameLen + size);
    expect(crc32(content)).toBe(crc);
    files[name] = decoder.decode(content);
    pos += 46 + nameLen;
  }
  return files;
}

describe("zip", () => {
  it("calcule le CRC-32 de référence", () => {
    expect(crc32(utf8("123456789"))).toBe(0xcbf43926);
  });

  it("encode l'UTF-8 comme TextEncoder, accents et emoji compris", () => {
    const text = "Éclair 🐴 — séance";
    expect(Array.from(utf8(text))).toEqual(Array.from(new TextEncoder().encode(text)));
  });

  it("produit une archive relisible avec ses noms accentués", () => {
    const zip = buildZip([
      { name: "séances.csv", data: utf8("a;b") },
      { name: "vide.txt", data: new Uint8Array(0) },
    ]);
    expect(readZip(zip)).toEqual({ "séances.csv": "a;b", "vide.txt": "" });
  });
});

describe("CSV", () => {
  it("met en forme chaque type de cellule pour Excel en français", () => {
    expect(formatCell(12.5)).toBe("12,5");
    expect(formatCell(true)).toBe("oui");
    expect(formatCell(null)).toBe("");
    expect(formatCell(d("2026-01-05"))).toBe("2026-01-05");
    expect(formatCell(new Date("x"))).toBe("");
  });

  it("neutralise les formules (injection CSV)", () => {
    expect(formatCell("=1+1")).toBe("'=1+1");
    expect(formatCell("-pas une formule")).toBe("'-pas une formule");
    expect(formatCell("ok - normal")).toBe("ok - normal");
  });

  it("protège séparateurs, guillemets et retours à la ligne, avec BOM et CRLF", () => {
    const csv = toCsv(["A", "B"], [['dit "oui"; puis', "ligne\nsuivante"]]);
    expect(csv).toBe('﻿A;B\r\n"dit ""oui""; puis";"ligne\nsuivante"\r\n');
  });
});

describe("buildExportFiles", () => {
  const files = Object.fromEntries(buildExportFiles(data, labels).map((f) => [f.name, f.content]));
  const rows = (name: string) => files[name].replace("﻿", "").trimEnd().split("\r\n");

  it("crée un fichier par type de donnée, plus un mode d'emploi", () => {
    expect(Object.keys(files)).toEqual([
      "LISEZMOI.txt",
      "chevaux.csv",
      "seances.csv",
      "rendez-vous.csv",
      "epreuves-concours.csv",
      "journal.csv",
      "depenses.csv",
      "poids.csv",
      "documents.csv",
      "objectifs.csv",
    ]);
  });

  it("traduit les valeurs techniques en libellés lisibles", () => {
    expect(rows("chevaux.csv")[1]).toBe(
      "Éclair;2015;Jument;Selle Français;Bai;165;540;Dressage;Niveau club;Propriétaire;Arthrose;Tendinite · 2025-03-02 · Guéri"
    );
    expect(rows("chevaux.csv")[2]).toBe("Pépite;;;;;;;;;Partagé (Demi-pension);;");
  });

  it("trie les séances par date et préfère le libellé libre de l'activité", () => {
    const seances = rows("seances.csv");
    expect(seances[1]).toBe("2026-10-10;;Éclair;Travail à pied;;;non;");
    expect(seances[2]).toBe('2026-10-20;18:00;Éclair;Dressage;45;Moyenne;oui;"Travail des ""épaules en dedans""; très bien"');
  });

  it("détaille les épreuves de concours à part, avec leur concours", () => {
    expect(rows("epreuves-concours.csv")[1]).toBe("2026-11-01;Éclair;CSO Lamotte;Club 2;Saut d'obstacles (CSO);10:30;3e");
    expect(rows("rendez-vous.csv")[1]).toContain("Concours;CSO Lamotte;Lamotte;;85,5;");
  });

  it("garde le journal, les dépenses, le poids, les documents et les objectifs", () => {
    expect(rows("journal.csv")[1]).toBe("2026-10-01;09:00;Pépite;Balade;Top;Ensoleillé, 15 °C;'=1+1;oui");
    expect(rows("depenses.csv")[1]).toBe("2026-10-05;Éclair;Pension;420,5;EUR;oui;");
    expect(rows("poids.csv")[1]).toBe("2026-09-01;Éclair;538");
    expect(rows("documents.csv")[1]).toBe("2026-09-15;Éclair;Facture;Facture véto");
    expect(rows("objectifs.csv")[1]).toBe("Club 1;Progresser en concours;2027-06-01;Éclair");
  });

  it("n'écrit que l'en-tête quand il n'y a rien à exporter", () => {
    const empty = buildExportFiles(
      { horses: [], sessions: [], appointments: [], journal: [], expenses: [], weights: [], documents: [], goals: [] },
      labels
    );
    expect(empty.find((f) => f.name === "poids.csv")?.content).toBe("﻿Date;Cheval;Poids (kg)\r\n");
  });
});

describe("buildExportZip", () => {
  it("réunit tous les fichiers dans une archive valide", () => {
    const files = readZip(buildExportZip(data, labels, d("2026-10-27")));
    expect(Object.keys(files)).toHaveLength(10);
    expect(files["poids.csv"]).toContain("2026-09-01;Éclair;538");
    expect(exportFileName(d("2026-10-27"))).toBe("Horsetrack-export-2026-10-27.zip");
  });
});
