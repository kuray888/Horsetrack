/**
 * Visuels App Store à partir des captures brutes (raw/<langue>/*.png) :
 * out/<langue>/<jeu>/NN-<écran>.png en 1290 × 2796, plus out/index.html pour
 * tout relire d'un coup d'œil. Usage : npm run setup (une fois), npm run render.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { LOCALES, PILL, SCREENS, SETS, SIZE } from "./screens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "../../node_modules/@expo-google-fonts/bricolage-grotesque");

// Palette de l'app et du site : marine, bleu, ciel, cuivre, crème. Chaque
// écran a sa couleur de fond pleine (comme les fiches qui convertissent le
// mieux : un aplat franc, un gros titre, le téléphone qui déborde en bas).
const THEMES = {
  navy: { bg: "#274c77", title: "#ffffff", sub: "#cfe0ef", glow: "#6096ba", glow2: "#3a6797", bezel: "#0b1420", pill: "#a3cef1", pillText: "#274c77" },
  blue: { bg: "#2378bd", title: "#ffffff", sub: "#dcecf9", glow: "#5aa9e6", glow2: "#1d6aa8", bezel: "#0b1420", pill: "#ffffff", pillText: "#1d6fb8" },
  sky: { bg: "#a3cef1", title: "#17385c", sub: "#2f5278", glow: "#cfe6f8", glow2: "#8fc0e8", bezel: "#0b1420", pill: "#274c77", pillText: "#ffffff" },
  copper: { bg: "#b66b45", title: "#ffffff", sub: "#fbe9de", glow: "#d28a63", glow2: "#9c5836", bezel: "#2a140a", pill: "#fff4ec", pillText: "#8a4a2a" },
  cream: { bg: "#f1ece2", title: "#274c77", sub: "#4d6178", glow: "#ffffff", glow2: "#e6dfd0", bezel: "#0b1420", pill: "#274c77", pillText: "#ffffff" },
};

function font(weight, file) {
  const path = join(FONTS, file);
  if (!existsSync(path)) throw new Error(`Police introuvable : ${path} (lancer pnpm install à la racine)`);
  return `@font-face{font-family:Bricolage;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(path).toString("base64")})}`;
}
const FONT_CSS = font(800, "800ExtraBold/BricolageGrotesque_800ExtraBold.ttf") + font(500, "500Medium/BricolageGrotesque_500Medium.ttf");
const LOGO = `data:image/png;base64,${readFileSync(join(HERE, "../../apps/mobile/assets/logo-mark.png")).toString("base64")}`;

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html({ title, sub, pill, theme, image, first }) {
  const c = THEMES[theme];
  const shot = image
    ? `<img src="data:image/png;base64,${image}" />`
    : `<div class="missing">Capture manquante</div>`;
  const brand = first ? `<div class="brand"><img src="${LOGO}"/><span>Horsetrack</span></div>` : "";
  const badge = pill ? `<div class="pill">${escapeHtml(pill)}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden}
body{background:${c.bg};font-family:Bricolage,sans-serif;position:relative}
.glow{position:absolute;border-radius:50%;filter:blur(2px)}
.g1{width:1100px;height:1100px;right:-420px;top:900px;background:${c.glow};opacity:.55}
.g2{width:760px;height:760px;left:-300px;top:1650px;background:${c.glow2};opacity:.7}
.brand{position:absolute;top:96px;left:96px;display:flex;align-items:center;gap:24px;color:${c.title};font-weight:800;font-size:54px;letter-spacing:-1px}
.brand img{width:92px;height:92px;border-radius:24px;background:#fff;padding:14px}
.text{position:absolute;top:${first ? 250 : 170}px;left:96px;right:96px}
.pill{display:inline-block;background:${c.pill};color:${c.pillText};font-weight:800;font-size:40px;padding:16px 36px;border-radius:999px;margin-bottom:44px}
h1{color:${c.title};font-weight:800;font-size:128px;line-height:1;letter-spacing:-3px;white-space:pre-line}
p{color:${c.sub};font-weight:500;font-size:48px;line-height:1.28;margin-top:40px;max-width:1040px}
.device{position:absolute;left:50%;transform:translateX(-50%);top:${first ? 930 : 860}px;width:1000px;
  border-radius:132px;background:${c.bezel};padding:22px;box-shadow:0 70px 140px rgba(8,20,36,.38)}
.device img,.missing{display:block;width:100%;border-radius:112px}
.missing{aspect-ratio:1290/2796;background:#c9d2da;color:#274c77;font-size:56px;display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="glow g1"></div><div class="glow g2"></div>
${brand}
<div class="text">${badge}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>
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
      await page.setContent(html({ ...screen[locale], theme: screen.theme, image, first: i === 0, pill: i === 0 ? PILL[locale] : null }), { waitUntil: "load" });
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
