/**
 * Génère un PDF de TEXTE, en pur JavaScript.
 *
 * Complément de pdfBuilder.ts (qui assemble des photos) et construit sur le
 * même principe : aucune dépendance native de plus. C'est une contrainte
 * durement acquise — une dépendance native a déjà fait planter l'app au
 * lancement en TestFlight (cf. lib/imagePicker.ts) —, et elle est tenable
 * ici parce que les 14 polices standard du format PDF, dont Helvetica, sont
 * fournies par le lecteur : rien à embarquer.
 *
 * Volontairement minimal : un flux de lignes, trois niveaux de style, des
 * sauts de page automatiques. Pas de tableaux ni d'images — le jour où il en
 * faudrait, ce serait le moment de peser une vraie bibliothèque.
 */

export type PdfTextLine =
  /** Titre du document, une seule fois en tête. */
  | { style: "title"; text: string }
  /** Titre de section. */
  | { style: "heading"; text: string }
  /** Ligne courante. */
  | { style: "body"; text: string }
  /** Ligne secondaire (gris, plus petit) : détail d'une ligne précédente. */
  | { style: "muted"; text: string }
  /** Espacement vertical, sans texte. */
  | { style: "space" };

const PAGE_WIDTH = 595; // A4 en points
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const STYLE = {
  title: { size: 20, leading: 30, gray: 0 },
  heading: { size: 13, leading: 24, gray: 0 },
  body: { size: 11, leading: 16, gray: 0 },
  muted: { size: 10, leading: 14, gray: 0.45 },
  space: { size: 0, leading: 10, gray: 0 },
} as const;

/** Caractères hors Latin-1 courants en français, et leur position en
 * WinAnsiEncoding (cp1252) — l'encodage que déclare le PDF. Sans cette
 * table, une apostrophe typographique ou un « œuf » sortirait en caractère
 * de remplacement au milieu d'un mot. */
const WIN_ANSI_EXTRAS: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

/** Un caractère qu'on ne sait pas encoder devient un point d'interrogation
 * plutôt que de casser le fichier : un PDF illisible serait pire qu'un
 * emoji manquant. */
const FALLBACK_BYTE = 0x3f;

/** Encode une chaîne en octets WinAnsi, avec l'échappement des caractères
 * réservés du format PDF (parenthèses et antislash). */
export function encodePdfString(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    let byte: number;
    if (code === 0x0a || code === 0x0d) byte = 0x20; // une ligne est une ligne
    else if (code < 0x100) byte = code;
    else byte = WIN_ANSI_EXTRAS[char] ?? FALLBACK_BYTE;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += "\\"; // ( ) \
    out += String.fromCharCode(byte);
  }
  return out;
}

/** Largeur approchée d'une ligne, pour savoir quand la couper. Helvetica est
 * à chasse variable ; 0,5 em par caractère est une moyenne prudente, qui
 * coupe parfois un peu tôt mais jamais trop tard — un débordement hors page
 * serait invisible à la lecture, donc pire qu'une coupe précoce. */
function approximateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.5;
}

/** Coupe une ligne trop longue aux espaces. Un mot plus long que la ligne
 * (une URL, un nom à rallonge) est laissé tel quel : le couper au milieu
 * gênerait plus la lecture que de le laisser dépasser un peu. */
function wrap(text: string, fontSize: number, maxWidth: number): string[] {
  if (approximateWidth(text, fontSize) <= maxWidth) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (approximateWidth(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Assemble le PDF. Retourne les octets du fichier, prêts à écrire sur disque
 * (cf. expo-file-system) puis à partager.
 */
export function buildTextPdf(lines: PdfTextLine[]): Uint8Array {
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  // 1. Mise en page : on répartit les lignes en pages avant d'écrire quoi que
  // ce soit, pour connaître leur nombre (le PDF doit l'annoncer d'avance).
  const pages: string[][] = [];
  let current: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of lines) {
    const style = STYLE[line.style];
    const texts = line.style === "space" ? [""] : wrap(line.text, style.size, maxWidth);
    for (const text of texts) {
      if (y - style.leading < MARGIN) {
        pages.push(current);
        current = [];
        y = PAGE_HEIGHT - MARGIN;
      }
      y -= style.leading;
      if (line.style !== "space" && text) {
        current.push(
          `BT /F1 ${style.size} Tf ${style.gray} g ${MARGIN} ${y.toFixed(1)} Td (${encodePdfString(text)}) Tj ET`
        );
      }
    }
  }
  pages.push(current);

  // 2. Écriture. Objets : 1 = Catalog, 2 = Pages, 3 = Font, puis 2 par page.
  const chunks: string[] = [];
  const offsets: number[] = [];
  let position = 0;
  function push(text: string) {
    offsets.push(position);
    chunks.push(text);
    position += text.length;
  }
  function pushObject(id: number, body: string) {
    const text = `${id} 0 obj\n${body}\nendobj\n`;
    offsets[id] = position;
    chunks.push(text);
    position += text.length;
  }

  push("%PDF-1.4\n");
  const pageIds = pages.map((_, i) => 4 + i * 2);
  pushObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObject(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );
  // Helvetica : l'une des 14 polices que tout lecteur PDF fournit, donc
  // aucune police à embarquer (cf. l'en-tête de ce module).
  pushObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pages.forEach((operations, i) => {
    const pageId = pageIds[i];
    const contentsId = pageId + 1;
    pushObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentsId} 0 R >>`
    );
    const stream = operations.join("\n");
    pushObject(contentsId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const objectCount = 3 + pages.length * 2;
  const xrefPosition = position;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objectCount; n++) xref += `${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`;
  chunks.push(xref);
  chunks.push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`);

  const text = chunks.join("");
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}
