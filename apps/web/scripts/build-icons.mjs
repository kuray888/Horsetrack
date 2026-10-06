/**
 * Génère les icônes du site à partir des sources de l'app mobile
 * (apps/mobile/assets) et les visuels PNG de l'image de partage :
 *
 *   node scripts/build-icons.mjs
 *
 * - public/brand/logo-mark.png : le « h. » détouré, utilisé en masque CSS
 *   (cf. Logo.tsx) pour pouvoir le teinter en marine ou en blanc ;
 * - src/app/favicon.ico (16/32/48), src/app/icon.png, src/app/apple-icon.png ;
 * - public/icons/icon-192.png, icon-512.png : manifeste web ;
 * - src/assets/og/*.png : téléphones pour opengraph-image.tsx (Satori ne lit
 *   pas le WebP).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE_ASSETS = path.join(ROOT, "../mobile/assets");
const CREAM = "#f6f4f0"; // fond de l'icône de l'app (cf. app.json)

const at = (...p) => path.join(ROOT, ...p);

/** Glyphe « h. » seul, sans marge, en noir sur transparent. */
async function trimmedMark(height) {
  return sharp(path.join(MOBILE_ASSETS, "logo-mark.png")).trim().resize({ height }).png().toBuffer();
}

/** Glyphe centré sur un carré crème arrondi (favicons : lisible à 16 px). */
async function favicon(size) {
  const r = Math.round(size * 0.22);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${CREAM}"/></svg>`
  );
  const mark = await trimmedMark(Math.round(size * 0.72));
  return sharp(bg).composite([{ input: mark, gravity: "center" }]).png().toBuffer();
}

/** .ico contenant des PNG (format accepté par tous les navigateurs actuels). */
function toIco(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

await mkdir(at("public/brand"), { recursive: true });
await mkdir(at("public/icons"), { recursive: true });
await mkdir(at("src/assets/og"), { recursive: true });

await writeFile(at("public/brand/logo-mark.png"), await trimmedMark(192));

const icoSizes = [16, 32, 48];
const icoPngs = await Promise.all(icoSizes.map(async (size) => ({ size, data: await favicon(size) })));
await writeFile(at("src/app/favicon.ico"), toIco(icoPngs));
await writeFile(at("src/app/icon.png"), await favicon(192));

// Icône de l'app telle quelle (fond plein : iOS et Android arrondissent eux-mêmes).
const appIcon = path.join(MOBILE_ASSETS, "icon.png");
await sharp(appIcon).resize(180).png().toFile(at("src/app/apple-icon.png"));
await sharp(appIcon).resize(192).png().toFile(at("public/icons/icon-192.png"));
await sharp(appIcon).resize(512).png().toFile(at("public/icons/icon-512.png"));

for (const name of ["accueil", "fiche-cheval", "planning-concours"]) {
  await sharp(at("src/assets/screens", `${name}.webp`))
    .resize({ height: 560 })
    .png({ compressionLevel: 9, palette: false })
    .toFile(at("src/assets/og", `${name}.png`));
}

console.log("Icônes et visuels de partage générés.");
