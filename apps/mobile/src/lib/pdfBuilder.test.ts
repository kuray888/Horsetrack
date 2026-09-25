import { describe, expect, it } from "vitest";
import { buildPdf, parseImageForPdf, sniffImageKind, type PdfPageImage } from "./pdfBuilder";

// Fixtures minuscules (60x40 : moitié gauche rouge, moitié droite bleue),
// générées hors dépôt puis validées en les faisant réellement rendre par un
// lecteur PDF (Quick Look macOS) — couleurs et sens de rotation compris.
const JPEG_60x40 = "/9j/4AAQSkZJRgABAQAASABIAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAKAA8AwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQABP/aAAwDAQACEQMRAD8A+W6KKK/n8/18Cuc8W/8AIv3X/AP/AENa6Ouc8W/8i/df8A/9DWv0Dwn/AOSpyr/sIo/+nInxHiZ/yTeZf9eKv/puR4tRRRX+3h/j8FFFFAH/0Pluiiiv5/P9fArnPFv/ACL91/wD/wBDWujrnPFv/Iv3X/AP/Q1r9A8J/wDkqcq/7CKP/pyJ8R4mf8k3mX/Xir/6bkeLUUUV/t4f4/BRRRQB/9H5booor+fz/XwK5zxb/wAi/df8A/8AQ1ro65zxb/yL91/wD/0Na/QPCf8A5KnKv+wij/6cifEeJn/JN5l/14q/+m5Hi1FFFf7eH+PwUUUUAf/Z";
const PNG_RGB_60x40 = "iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAAPklEQVR4nO3OMQ0AAAzDsCIpf1ADMxT9LOWOnGtHzcYXaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGjoJfoBv7FBlzZbfZgAAAAASUVORK5CYII=";
const PNG_RGBA_60x40 = "iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAYAAACiu5n/AAAARklEQVR4nO3PMQEAAAgDIJOsfyi7aAt9OAhAdTIfkn5RwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCtxayuZi+LLR70gAAAABJRU5ErkJggg==";

const fromBase64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

/** Insère un segment APP1 EXIF portant l'orientation demandée juste après SOI. */
function withExifOrientation(jpeg: Uint8Array, orientation: number): Uint8Array {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, offset IFD0
    0x01, 0x00, // 1 entrée
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, // tag 0x0112 SHORT
    0x00, 0x00, 0x00, 0x00, // pas d'IFD suivant
  ];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = body.length + 2;
  const segment = [0xff, 0xe1, length >> 8, length & 0xff, ...body];
  return new Uint8Array([...jpeg.slice(0, 2), ...segment, ...jpeg.slice(2)]);
}

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("parseImageForPdf", () => {
  it("lit les dimensions d'un JPEG", () => {
    const page = parseImageForPdf(fromBase64(JPEG_60x40));
    expect(page).toMatchObject({ kind: "jpeg", width: 60, height: 40, components: 3, rotation: 0 });
  });

  it.each([
    [1, 0],
    [3, 180],
    [6, 90],
    [8, 270],
  ])("traduit l'orientation EXIF %i en rotation %i°", (orientation, rotation) => {
    const page = parseImageForPdf(withExifOrientation(fromBase64(JPEG_60x40), orientation));
    expect(page).toMatchObject({ kind: "jpeg", rotation });
  });

  it("accepte un PNG RVB 8 bits", () => {
    expect(parseImageForPdf(fromBase64(PNG_RGB_60x40))).toMatchObject({ kind: "png", width: 60, height: 40, colors: 3 });
  });

  it("refuse un PNG avec canal alpha plutôt que de le dégrader en silence", () => {
    expect(parseImageForPdf(fromBase64(PNG_RGBA_60x40))).toBeNull();
  });

  it("refuse ce qui n'est pas une image embarquable (HEIC brut, données tronquées, vide)", () => {
    const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
    expect(parseImageForPdf(heic)).toBeNull();
    expect(parseImageForPdf(fromBase64(JPEG_60x40).slice(0, 12))).toBeNull();
    expect(parseImageForPdf(new Uint8Array(0))).toBeNull();
  });
});

describe("buildPdf", () => {
  const jpeg = parseImageForPdf(fromBase64(JPEG_60x40)) as PdfPageImage;
  const png = parseImageForPdf(fromBase64(PNG_RGB_60x40)) as PdfPageImage;

  it("refuse de construire un PDF sans page", () => {
    expect(() => buildPdf([])).toThrow();
  });

  it("produit un PDF bien formé dont chaque offset xref pointe sur son objet", () => {
    const pdf = buildPdf([jpeg, png, jpeg]);
    const content = text(pdf);
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(content).toContain("/Count 3");

    const xrefAt = Number(/startxref\n(\d+)/.exec(content)![1]);
    expect(content.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = content.slice(xrefAt).split("\n").filter((l) => /^\d{10} \d{5} n/.test(l));
    expect(entries).toHaveLength(2 + 3 * 3);
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(content.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it("annonce la longueur exacte du flux image (sinon le lecteur ne peut pas l'ouvrir)", () => {
    const content = text(buildPdf([jpeg]));
    const length = Number(/\/Length (\d+) >>\nstream\n\xff\xd8/.exec(content)![1]);
    expect(length).toBe((jpeg as { data: Uint8Array }).data.length);
  });

  it("garde une page à la largeur A4 et suit le ratio de la photo", () => {
    const content = text(buildPdf([jpeg]));
    expect(content).toContain("/MediaBox [0 0 595 396.67]");
    expect(content).toContain("/Rotate 0");
  });

  it("recalcule l'échelle sur la largeur AFFICHÉE quand la photo est tournée de 90°", () => {
    const rotated = parseImageForPdf(withExifOrientation(fromBase64(JPEG_60x40), 6)) as PdfPageImage;
    const content = text(buildPdf([rotated]));
    // 60x40 tournée : affichée 40 de large → échelle 14,875 ; page 595 de large une fois pivotée.
    expect(content).toContain("/MediaBox [0 0 892.50 595]");
    expect(content).toContain("/Rotate 90");
  });

  it("embarque un PNG avec prédicteur plutôt que comme un JPEG", () => {
    const content = text(buildPdf([png]));
    expect(content).toContain("/FlateDecode");
    expect(content).toContain("/Predictor 15 /Colors 3");
    expect(content).not.toContain("/DCTDecode");
  });
});

describe("sniffImageKind", () => {
  it("reconnaît le format par les octets, pas par le nom", () => {
    expect(sniffImageKind(fromBase64(JPEG_60x40))).toBe("jpeg");
    expect(sniffImageKind(fromBase64(PNG_RGB_60x40))).toBe("png");
    // Un PNG avec alpha reste un PNG (seul le regroupement en PDF le refuse).
    expect(sniffImageKind(fromBase64(PNG_RGBA_60x40))).toBe("png");
  });

  it("renvoie null pour du HEIC brut ou des données vides", () => {
    const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(sniffImageKind(heic)).toBeNull();
    expect(sniffImageKind(new Uint8Array(0))).toBeNull();
  });
});
