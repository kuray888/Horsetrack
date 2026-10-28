/**
 * Détoure les téléphones des captures App Store (1320×2868, fond crème +
 * bandeau bleu, cf. docs/fiche-app-store.md) pour les réutiliser sur le site
 * sans leur fond ni leur titre : le téléphone ET ses étiquettes flottantes
 * (« Rappel activé »…) sont gardés, sur fond transparent.
 *
 *   node scripts/extract-screens.mjs <dossier des captures>
 *
 * Le fond des captures est uni par ligne (crème, filet cuivre, bleu) : chaque
 * pixel relié au bord de l'image et égal au fond de sa ligne devient
 * transparent ; un pixel qui n'est qu'un assombrissement de ce fond (ombre
 * portée, anticrénelage du contour du téléphone) devient du noir
 * semi-transparent. On ne garde ensuite que la forme qui contient le centre
 * du téléphone (le titre et le logo du bas sont écartés).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/assets/screens");

// Numéro de la capture (ordre de la fiche App Store) → nom du fichier produit.
const SCREENS = {
  1: "accueil",
  2: "nouvelle-seance",
  3: "fiche-cheval",
  4: "planning-concours",
  5: "journal",
  6: "chevaux",
  7: "ajouter-cheval",
};

const BG_TOLERANCE = 4; // écart max (par canal) pour être « le fond »
// Écart max à la droite fond→noir pour être une ombre : l'ombre des visuels
// est un gris légèrement teinté, d'où une marge qui croît avec son opacité
// (les étiquettes colorées, elles, s'en écartent de 60 et plus).
const SHADOW_TOLERANCE = 6;
const SHADOW_TOLERANCE_PER_ALPHA = 30;
const SHADOW_MIN_K = 0.25; // en dessous, c'est le contour noir du téléphone
const KEEP_ALPHA = 8; // alpha (0-255) minimal pour relier deux zones

async function extract(file, name) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const n = W * H;

  // 0 = fond, 1 = ombre (fond assombri), 2 = premier plan
  const kind = new Uint8Array(n);
  const shade = new Uint8Array(n); // alpha de l'ombre
  for (let y = 0; y < H; y++) {
    const b = y * W * 3; // fond de la ligne = pixel du bord gauche
    const br = data[b], bg = data[b + 1], bb = data[b + 2];
    const bb2 = br * br + bg * bg + bb * bb;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 3;
      const r = data[o], g = data[o + 1], bl = data[o + 2];
      if (Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(bl - bb)) <= BG_TOLERANCE) continue;
      const k = (r * br + g * bg + bl * bb) / bb2;
      const res = Math.max(Math.abs(r - k * br), Math.abs(g - k * bg), Math.abs(bl - k * bb));
      if (k >= SHADOW_MIN_K && k < 1.02 && res <= SHADOW_TOLERANCE + SHADOW_TOLERANCE_PER_ALPHA * (1 - k)) {
        kind[i] = 1;
        shade[i] = Math.round(Math.min(1, Math.max(0, 1 - k)) * 255);
      } else {
        kind[i] = 2;
      }
    }
  }

  // Extérieur = fond ou ombre relié au bord de l'image.
  const outside = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const pushIf = (i) => {
    if (!outside[i] && kind[i] !== 2) {
      outside[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < W; x++) {
    pushIf(x);
    pushIf((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    pushIf(y * W);
    pushIf(y * W + W - 1);
  }
  while (sp) {
    const i = stack[--sp];
    const x = i % W;
    if (x > 0) pushIf(i - 1);
    if (x < W - 1) pushIf(i + 1);
    if (i >= W) pushIf(i - W);
    if (i < n - W) pushIf(i + W);
  }

  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) alpha[i] = !outside[i] ? 255 : kind[i] === 1 ? shade[i] : 0;

  // Ne garder que la forme qui contient le centre du téléphone.
  const keep = new Uint8Array(n);
  const seed = Math.round(H * 0.52) * W + Math.round(W / 2);
  if (alpha[seed] < KEEP_ALPHA) throw new Error(`${name} : le centre de l'image n'est pas sur le téléphone`);
  sp = 0;
  keep[seed] = 1;
  stack[sp++] = seed;
  let minX = W, minY = H, maxX = 0, maxY = 0;
  while (sp) {
    const i = stack[--sp];
    const x = i % W, y = (i / W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j >= 0 && j < n && !keep[j] && alpha[j] >= KEEP_ALPHA) {
        keep[j] = 1;
        stack[sp++] = j;
      }
    }
  }

  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y + minY) * W + (x + minX);
      const o = (y * cw + x) * 4;
      if (!keep[i]) continue; // reste transparent
      const solid = !outside[i];
      out[o] = solid ? data[i * 3] : 0;
      out[o + 1] = solid ? data[i * 3 + 1] : 0;
      out[o + 2] = solid ? data[i * 3 + 2] : 0;
      out[o + 3] = alpha[i];
    }
  }

  const target = path.join(OUT_DIR, `${name}.webp`);
  await sharp(out, { raw: { width: cw, height: ch, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(target);
  console.log(`${name}.webp  ${cw}×${ch}`);
}

const dir = process.argv[2];
if (!dir) {
  console.error("Usage : node scripts/extract-screens.mjs <dossier contenant 1.png … 7.png>");
  process.exit(1);
}
for (const [num, name] of Object.entries(SCREENS)) {
  const file = path.join(dir, `${num}.png`);
  await readFile(file); // erreur explicite si la capture manque
  await extract(file, name);
}
