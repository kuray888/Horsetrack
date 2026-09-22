import { describe, expect, it } from "vitest";
import { buildTextPdf, encodePdfString, type PdfTextLine } from "@/lib/pdfText";

const decode = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe("encodePdfString", () => {
  it("échappe les caractères réservés du format", () => {
    // Sans ça, une parenthèse dans une note terminerait la chaîne PDF et
    // produirait un fichier illisible.
    expect(encodePdfString("Vaccin (rappel)")).toBe("Vaccin \\(rappel\\)");
    expect(encodePdfString("a\\b")).toBe("a\\\\b");
  });

  it("garde les accents français, qui sont dans WinAnsi", () => {
    expect(encodePdfString("é")).toBe(String.fromCharCode(0xe9));
  });

  it("encode les caractères typographiques hors Latin-1", () => {
    expect(encodePdfString("’")).toBe(String.fromCharCode(0x92));
    expect(encodePdfString("œ")).toBe(String.fromCharCode(0x9c));
  });

  it("remplace ce qu'il ne sait pas encoder plutôt que de casser le fichier", () => {
    expect(encodePdfString("🐴")).toBe("?");
  });

  it("aplatit les retours à la ligne, qui se gèrent ligne par ligne", () => {
    expect(encodePdfString("a\nb")).toBe("a b");
  });
});

describe("buildTextPdf", () => {
  it("produit un PDF valide, en-tête et fin de fichier compris", () => {
    const pdf = decode(buildTextPdf([{ style: "body", text: "Bonjour" }]));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
  });

  it("déclare Helvetica, qu'aucun lecteur n'a besoin de télécharger", () => {
    const pdf = decode(buildTextPdf([{ style: "body", text: "Bonjour" }]));
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("/Encoding /WinAnsiEncoding");
  });

  it("écrit le texte demandé", () => {
    expect(decode(buildTextPdf([{ style: "heading", text: "Soins" }]))).toContain("(Soins) Tj");
  });

  it("passe à la page suivante quand la première est pleine", () => {
    const many: PdfTextLine[] = Array.from({ length: 80 }, (_, i) => ({ style: "body", text: `Ligne ${i}` }));
    const pdf = decode(buildTextPdf(many));
    // Deux pages au moins, et le compte annoncé doit suivre — un PDF qui
    // annonce un nombre de pages faux ne s'ouvre pas.
    expect(pdf).toContain("/Count 2");
    expect((pdf.match(/\/Type \/Page[^s]/g) ?? []).length).toBe(2);
  });

  it("coupe une ligne trop longue au lieu de la laisser déborder", () => {
    const pdf = decode(buildTextPdf([{ style: "body", text: "mot ".repeat(60).trim() }]));
    expect((pdf.match(/Tj/g) ?? []).length).toBeGreaterThan(1);
  });

  it("accepte un document vide sans produire de fichier cassé", () => {
    const pdf = decode(buildTextPdf([]));
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf).toContain("/Count 1");
  });
});
