/**
 * Visuels App Store à partir des captures brutes (raw/<langue>/*.png) :
 * out/<langue>/<jeu>/NN-<écran>.png en 1290 × 2796, plus out/index.html pour
 * tout relire d'un coup d'œil. Usage : npm run setup (une fois), npm run render.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { LOCALES, SCREENS, SETS, SIZE } from "./screens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "../../node_modules/@expo-google-fonts/bricolage-grotesque");

// Palette « marine » de l'app (src/theme/tokens.cjs).
const THEMES = {
  dark: { bg: "#274c77", title: "#ffffff", sub: "#cfe0ef", bezel: "#0e1621" },
  light: { bg: "#e7ecef", title: "#274c77", sub: "#4d6178", bezel: "#0e1621" },
};

function font(weight, file) {
  const path = join(FONTS, file);
  if (!existsSync(path)) throw new Error(`Police introuvable : ${path} (lancer pnpm install à la racine)`);
  return `@font-face{font-family:Bricolage;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(path).toString("base64")})}`;
}
const FONT_CSS = font(800, "800ExtraBold/BricolageGrotesque_800ExtraBold.ttf") + font(500, "500Medium/BricolageGrotesque_500Medium.ttf");

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html({ title, sub, theme, image }) {
  const c = THEMES[theme];
  const shot = image
    ? `<img src="data:image/png;base64,${image}" />`
    : `<div class="missing">Capture manquante</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden}
body{background:${c.bg};font-family:Bricolage,sans-serif;position:relative}
.text{position:absolute;top:150px;left:96px;right:96px}
h1{color:${c.title};font-weight:800;font-size:112px;line-height:1.02;letter-spacing:-2px;white-space:pre-line}
p{color:${c.sub};font-weight:500;font-size:46px;line-height:1.3;margin-top:40px;max-width:1050px}
.device{position:absolute;left:50%;transform:translateX(-50%);top:720px;width:1040px;
  border-radius:132px;background:${c.bezel};padding:24px;box-shadow:0 60px 120px rgba(8,20,36,.35)}
.device img,.missing{display:block;width:100%;border-radius:110px}
.missing{aspect-ratio:1290/2796;background:#c9d2da;color:#274c77;font-size:56px;display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="text"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>
<div class="device">${shot}</div>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
const index = [];
let missing = 0;

for (const locale of LOCALES) {
  for (const [setName, ids] of Object.entries(SETS)) {
    const dir = join(HERE, "out", locale, setName);
    mkdirSync(dir, { recursive: true });
    const row = [];
    for (const [i, id] of ids.entries()) {
      const screen = SCREENS[id];
      const rawPath = join(HERE, "raw", locale, `${screen.capture}.png`);
      const image = existsSync(rawPath) ? readFileSync(rawPath).toString("base64") : null;
      if (!image) {
        missing++;
        console.warn(`! capture manquante : raw/${locale}/${screen.capture}.png`);
      }
      await page.setContent(html({ ...screen[locale], theme: screen.theme, image }), { waitUntil: "load" });
      const file = join(dir, `${String(i + 1).padStart(2, "0")}-${id}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, ...SIZE } });
      row.push(relative(join(HERE, "out"), file));
    }
    index.push({ locale, setName, row });
  }
}
await browser.close();

writeFileSync(
  join(HERE, "out", "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Visuels App Store</title>
<style>body{font-family:system-ui;margin:24px;background:#f4f6f8}h2{margin:32px 0 12px}
.row{display:flex;gap:12px;overflow-x:auto}.row img{height:420px;border-radius:12px}</style>
${index.map(({ locale, setName, row }) => `<h2>${locale.toUpperCase()} · jeu « ${setName} »</h2><div class="row">${row.map((f) => `<img src="${f}">`).join("")}</div>`).join("\n")}`
);
console.log(`Terminé : ${index.length} jeux dans out/ (aperçu : out/index.html)${missing ? `, ${missing} capture(s) manquante(s)` : ""}.`);
