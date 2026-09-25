/**
 * Assemble plusieurs photos en UN SEUL PDF (une page par photo) — pur
 * JavaScript, sans dépendance native ni import react-native : testable avec
 * vitest (cf. pdfBuilder.test.ts), et surtout aucun module natif de plus
 * dans le build (cf. lib/imagePicker.ts : une dépendance native a déjà fait
 * planter l'app au lancement en TestFlight, on n'en ajoute que le strict
 * nécessaire).
 *
 * Pourquoi ça existe : un compte rendu de clinique tient souvent sur
 * plusieurs pages photographiées, et un document ne pouvait contenir qu'UNE
 * image. Un PDF multi-pages tient dans le modèle existant (un seul fichier
 * par document, déjà synchronisé et déjà consultable via "Consulter le PDF",
 * cf. agenda/components/DocumentCard.tsx) — aucun changement de base.
 *
 * Les octets JPEG sont embarqués tels quels (filtre DCTDecode, aucun
 * réencodage, donc aucune perte de qualité ni de temps de calcul). Les PNG
 * sans transparence (RVB ou gris 8 bits, non entrelacés) sont embarqués via
 * FlateDecode + prédicteur PNG. Tout autre format (HEIC brut, PNG avec canal
 * alpha, JPEG CMJN...) est refusé par `parseImageForPdf` (renvoie null) —
 * l'appelant doit alors prévenir l'utilisateur plutôt que de perdre une page
 * en silence.
 */

export type PdfPageImage =
  | {
      kind: "jpeg";
      width: number;
      height: number;
      components: 1 | 3;
      /** Rotation d'affichage (sens horaire) déduite de l'orientation EXIF :
       * DCTDecode ignore EXIF, une photo portrait prise à l'iPhone (capteur
       * paysage + orientation 6) apparaîtrait sinon couchée sur le côté. */
      rotation: 0 | 90 | 180 | 270;
      data: Uint8Array;
    }
  | {
      kind: "png";
      width: number;
      height: number;
      colors: 1 | 3;
      /** Concaténation des blocs IDAT (flux zlib avec filtres PNG) tel quel. */
      data: Uint8Array;
    };

const PAGE_WIDTH_PT = 595; // largeur A4 en points ; la hauteur suit le ratio de la photo

/** Correspondance orientation EXIF → rotation d'affichage horaire. Les
 * variantes miroir (2, 4, 5, 7) n'arrivent pas avec un appareil photo
 * arrière : on n'applique que la rotation. */
const ROTATION_BY_EXIF: Record<number, 0 | 90 | 180 | 270> = {
  1: 0,
  2: 0,
  3: 180,
  4: 180,
  5: 270,
  6: 90,
  7: 90,
  8: 270,
};

function readExifOrientation(b: Uint8Array, tiffStart: number, segmentEnd: number): number {
  if (tiffStart + 8 > segmentEnd) return 1;
  const littleEndian = b[tiffStart] === 0x49 && b[tiffStart + 1] === 0x49; // "II"
  const bigEndian = b[tiffStart] === 0x4d && b[tiffStart + 1] === 0x4d; // "MM"
  if (!littleEndian && !bigEndian) return 1;

  const u16 = (o: number) => (littleEndian ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) =>
    (littleEndian
      ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)
      : (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

  if (u16(tiffStart + 2) !== 42) return 1;
  const ifd = tiffStart + u32(tiffStart + 4);
  if (ifd + 2 > segmentEnd) return 1;
  const entries = u16(ifd);
  for (let k = 0; k < entries; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > segmentEnd) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function parseJpeg(b: Uint8Array): PdfPageImage | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let orientation = 1;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // octets de remplissage
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2; // marqueurs sans longueur
      continue;
    }
    if (marker === 0xd9) break;

    const length = (b[i + 2] << 8) | b[i + 3];
    if (length < 2) return null;
    const segment = i + 4;

    // APP1 "Exif\0\0" → orientation
    if (
      marker === 0xe1 &&
      length >= 8 &&
      b[segment] === 0x45 && // E
      b[segment + 1] === 0x78 && // x
      b[segment + 2] === 0x69 && // i
      b[segment + 3] === 0x66 && // f
      b[segment + 4] === 0 &&
      b[segment + 5] === 0
    ) {
      orientation = readExifOrientation(b, segment + 6, i + 2 + length);
    }

    // SOF0 (baseline), SOF1 (étendu), SOF2 (progressif) — le reste (codage
    // arithmétique, sans perte...) n'est pas pris en charge.
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const precision = b[segment];
      const height = (b[segment + 1] << 8) | b[segment + 2];
      const width = (b[segment + 3] << 8) | b[segment + 4];
      const components = b[segment + 5];
      if (precision !== 8 || width === 0 || height === 0) return null;
      if (components !== 1 && components !== 3) return null; // CMJN : couleurs inversées, refusé
      return {
        kind: "jpeg",
        width,
        height,
        components,
        rotation: ROTATION_BY_EXIF[orientation] ?? 0,
        data: b,
      };
    }
    if (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return null;

    i += 2 + length;
  }
  return null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function parsePng(b: Uint8Array): PdfPageImage | null {
  if (b.length < 33) return null;
  for (let k = 0; k < PNG_SIGNATURE.length; k++) if (b[k] !== PNG_SIGNATURE[k]) return null;

  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 1;
  const idat: Uint8Array[] = [];

  let i = 8;
  while (i + 8 <= b.length) {
    const length = u32(i);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const data = i + 8;
    if (data + length > b.length) return null;
    if (type === "IHDR" && length >= 13) {
      width = u32(data);
      height = u32(data + 4);
      bitDepth = b[data + 8];
      colorType = b[data + 9];
      interlace = b[data + 12];
    } else if (type === "IDAT") {
      idat.push(b.subarray(data, data + length));
    } else if (type === "IEND") {
      break;
    }
    i = data + length + 4; // + CRC
  }

  // 8 bits, gris (0) ou RVB (2), non entrelacé : les seuls cas embarquables
  // sans décompresser. Un PNG avec alpha (types 4/6) exigerait un masque
  // séparé, donc de décompresser et recompresser — hors de propos ici.
  if (width === 0 || height === 0 || bitDepth !== 8 || interlace !== 0) return null;
  if (colorType !== 0 && colorType !== 2) return null;
  if (idat.length === 0) return null;

  const total = idat.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of idat) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return { kind: "png", width, height, colors: colorType === 0 ? 1 : 3, data: joined };
}

/** Format réel d'une image d'après ses premiers octets (jamais son extension ni
 * son mimeType : le sélecteur iOS peut livrer du JPEG sous un nom ".heic"). */
export function sniffImageKind(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return "png";
  return null;
}

/** Analyse les octets d'une image ; null si le format n'est pas embarquable
 * dans un PDF par ce module (cf. en-tête de fichier). Détection par
 * signature, jamais par extension ni mimeType : le sélecteur iOS peut livrer
 * de l'HEIC sous un nom en ".jpg". */
export function parseImageForPdf(bytes: Uint8Array): PdfPageImage | null {
  return parseJpeg(bytes) ?? parsePng(bytes);
}

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let k = 0; k < text.length; k++) out[k] = text.charCodeAt(k) & 0xff;
  return out;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Construit le PDF : une page par image, largeur A4 (595 pt), hauteur selon
 * le ratio de la photo — pas de bandes blanches, la page épouse la photo. */
export function buildPdf(pages: PdfPageImage[]): Uint8Array {
  if (pages.length === 0) throw new Error("buildPdf : aucune page");

  const chunks: Uint8Array[] = [];
  const offsets: number[] = []; // offsets[n] = position de l'objet n
  let position = 0;
  const push = (chunk: Uint8Array) => {
    chunks.push(chunk);
    position += chunk.length;
  };
  const pushText = (text: string) => push(ascii(text));

  pushText("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // commentaire binaire

  // Objets : 1 = Catalog, 2 = Pages, puis 3 objets par page (Page, Contents, Image).
  const pageObject = (i: number) => 3 + i * 3;
  const objectCount = 2 + pages.length * 3;

  offsets[1] = position;
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets[2] = position;
  const kids = pages.map((_, i) => `${pageObject(i)} 0 R`).join(" ");
  pushText(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const pageId = pageObject(i);
    const contentsId = pageId + 1;
    const imageId = pageId + 2;

    const rotation = page.kind === "jpeg" ? page.rotation : 0;
    // L'échelle est calculée sur la largeur AFFICHÉE : après une rotation de
    // 90/270°, la largeur affichée est la hauteur de l'image.
    const displayedWidth = rotation === 90 || rotation === 270 ? page.height : page.width;
    const scale = PAGE_WIDTH_PT / displayedWidth;
    const mediaWidth = page.width * scale;
    const mediaHeight = page.height * scale;

    offsets[pageId] = position;
    pushText(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(mediaWidth)} ${formatNumber(
        mediaHeight
      )}] /Rotate ${rotation} /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentsId} 0 R >>\nendobj\n`
    );

    const contents = `q ${formatNumber(mediaWidth)} 0 0 ${formatNumber(mediaHeight)} 0 0 cm /Im0 Do Q`;
    offsets[contentsId] = position;
    pushText(`${contentsId} 0 obj\n<< /Length ${contents.length} >>\nstream\n${contents}\nendstream\nendobj\n`);

    const colorSpace = (page.kind === "jpeg" ? page.components : page.colors) === 1 ? "/DeviceGray" : "/DeviceRGB";
    const filter =
      page.kind === "jpeg"
        ? "/Filter /DCTDecode"
        : `/Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${page.colors} /BitsPerComponent 8 /Columns ${page.width} >>`;
    offsets[imageId] = position;
    pushText(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 ${filter} /Length ${page.data.length} >>\nstream\n`
    );
    push(page.data);
    pushText("\nendstream\nendobj\n");
  });

  const xrefPosition = position;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objectCount; n++) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  pushText(xref);
  pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`);

  const out = new Uint8Array(position);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}
