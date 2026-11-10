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

// Palette de l'app et du site : marine, bleu, ciel, cuivre, crème.
const THEMES = {
  navy: { bg: "#274c77", title: "#ffffff", sub: "#cfe0ef", acc: "#a3cef1", kick: "#a3cef1", glow: "#3a6797", glow2: "#1f3f63", pill: "#a3cef1", pillText: "#17385c" },
  blue: { bg: "#2378bd", title: "#ffffff", sub: "#e1effa", acc: "#ffe3bd", kick: "#cfe6f8", glow: "#3f8fd1", glow2: "#1b6aa8", pill: "#ffffff", pillText: "#1d6fb8" },
  sky: { bg: "#a3cef1", title: "#17385c", sub: "#2f5278", acc: "#a35a36", kick: "#274c77", glow: "#c6e1f7", glow2: "#8fc0e8", pill: "#274c77", pillText: "#ffffff" },
  copper: { bg: "#b66b45", title: "#ffffff", sub: "#fdeee2", acc: "#ffe0c4", kick: "#ffe0c4", glow: "#c97d56", glow2: "#9c5836", pill: "#fff4ec", pillText: "#8a4a2a" },
  cream: { bg: "#f1ece2", title: "#274c77", sub: "#4d6178", acc: "#b66b45", kick: "#a35a36", glow: "#fbf8f1", glow2: "#e6dfd0", pill: "#274c77", pillText: "#ffffff" },
};

function font(weight, file) {
  const path = join(FONTS, file);
  if (!existsSync(path)) throw new Error(`Police introuvable : ${path} (lancer pnpm install à la racine)`);
  return `@font-face{font-family:Bricolage;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(path).toString("base64")})}`;
}
const FONT_CSS = font(800, "800ExtraBold/BricolageGrotesque_800ExtraBold.ttf") + font(500, "500Medium/BricolageGrotesque_500Medium.ttf");
const LOGO = `data:image/png;base64,${readFileSync(join(HERE, "../../apps/mobile/assets/logo-mark.png")).toString("base64")}`;

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** « mot **souligné** » → <span class="hl">. */
const richTitle = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>');

// Capture brute : 1320 × 2868 (iPhone 17 Pro Max).
const RAW = { w: 1320, h: 2868 };

/** Un iPhone : anneau en titane, lunette noire, Dynamic Island, boutons
 * latéraux, léger reflet sur la vitre. `w` = largeur totale, en px. */
function phone({ w, x, y, rot = 0, z = 1 }) {
  const ring = Math.round(w * 0.012);
  const bezel = Math.round(w * 0.022);
  const sw = w - 2 * (ring + bezel); // largeur de l'écran
  const sh = Math.round((sw * RAW.h) / RAW.w);
  const outerR = Math.round(w * 0.17);
  const screenR = outerR - ring - bezel;
  const h = sh + 2 * (ring + bezel);
  const btn = (side, top, hh) =>
    `<i class="btn" style="${side}:${-Math.round(w * 0.012)}px;top:${Math.round(h * top)}px;height:${Math.round(h * hh)}px;width:${Math.round(w * 0.016)}px"></i>`;
  return `<div class="phone" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${outerR}px;padding:${ring}px;transform:rotate(${rot}deg);z-index:${z}">
    ${btn("left", 0.13, 0.035)}${btn("left", 0.2, 0.07)}${btn("left", 0.285, 0.07)}${btn("right", 0.24, 0.11)}
    <div class="bezel" style="padding:${bezel}px;border-radius:${outerR - ring}px">
      <div class="screen" style="width:${sw}px;height:${sh}px;border-radius:${screenR}px">
        <div class="shot"></div>
        <div class="island" style="top:${Math.round(sw * 0.021)}px;width:${Math.round(sw * 0.285)}px;height:${Math.round(sw * 0.085)}px"></div>
        <div class="glass"></div>
      </div>
    </div>
  </div>`;
}

/** Une carte découpée dans la capture brute, qui flotte devant le téléphone. */
function card({ crop, width, x, y, rot = 0 }) {
  const [cx, cy, cw, ch] = crop;
  const pad = 14;
  const iw = width - 2 * pad;
  const sc = iw / cw;
  const ih = Math.round(ch * sc);
  return `<div class="card" style="left:${x}px;top:${y}px;width:${width}px;height:${ih + 2 * pad}px;padding:${pad}px;transform:rotate(${rot}deg)">
    <div class="cardimg" style="width:${iw}px;height:${ih}px;background-size:${Math.round(RAW.w * sc)}px auto;background-position:${-Math.round(cx * sc)}px ${-Math.round(cy * sc)}px"></div>
  </div>`;
}

function html({ kicker, title, sub, pill, theme, image, cardImage, layout, cardSpec, first }) {
  const c = THEMES[theme];
  const brand = first ? `<div class="brand"><img src="${LOGO}"/><span>Horsetrack</span></div>` : "";
  const badge = pill ? `<div class="pill">${escapeHtml(pill)}</div>` : "";
  const top = first ? 250 : 170;
  const phones =
    layout === "tilt"
      ? phone({ w: 960, x: 200, y: 1010, rot: 5, z: 1 })
      : phone({ w: 1000, x: 145, y: 940, rot: 0, z: 1 });
  const floating = cardSpec ? card(cardSpec) : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
:root{--shot:${image ? `url(data:image/png;base64,${image})` : "none"};--shotc:${cardImage ? `url(data:image/png;base64,${cardImage})` : image ? `url(data:image/png;base64,${image})` : "none"}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden}
body{background:${c.bg};font-family:Bricolage,sans-serif;position:relative}
.glow{position:absolute;border-radius:50%}
.g1{width:1200px;height:1200px;right:-520px;top:760px;background:${c.glow};opacity:.6}
.g2{width:820px;height:820px;left:-360px;top:1900px;background:${c.glow2};opacity:.75}
.brand{position:absolute;top:96px;left:96px;display:flex;align-items:center;gap:24px;color:${c.title};font-weight:800;font-size:54px;letter-spacing:-1px}
.brand img{width:92px;height:92px;border-radius:24px;background:#fff;padding:14px}
.text{position:absolute;top:${top}px;left:96px;right:96px;z-index:5}
.kicker{display:flex;align-items:center;gap:20px;color:${c.kick};font-weight:800;font-size:38px;letter-spacing:6px;text-transform:uppercase;margin-bottom:36px}
.kicker::before{content:"";width:64px;height:6px;border-radius:3px;background:${c.kick}}
.pill{display:inline-block;background:${c.pill};color:${c.pillText};font-weight:800;font-size:40px;padding:16px 36px;border-radius:999px;margin-bottom:36px}
h1{color:${c.title};font-weight:800;font-size:122px;line-height:1.01;letter-spacing:-3px;white-space:pre-line}
.hl{color:${c.acc};position:relative;white-space:nowrap}
.hl::after{content:"";position:absolute;left:-4px;right:-4px;bottom:-10px;height:14px;border-radius:8px;background:${c.acc};opacity:.55;transform:rotate(-1.2deg)}
p.sub{color:${c.sub};font-weight:500;font-size:46px;line-height:1.3;margin-top:52px;max-width:1000px}
.phone{position:absolute;background:linear-gradient(135deg,#e4e6e9 0%,#9a9da3 28%,#d6d8dc 52%,#7d8087 78%,#c9ccd1 100%);box-shadow:0 80px 150px rgba(6,16,30,.42),0 20px 40px rgba(6,16,30,.25)}
.bezel{background:#05070a;height:100%;position:relative}
.screen{position:relative;overflow:hidden;background:#e7ecef}
.shot{position:absolute;inset:0;background-image:var(--shot);background-size:100% 100%}
.island{position:absolute;left:50%;transform:translateX(-50%);background:#000;border-radius:999px}
.glass{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 32%)}
.btn{position:absolute;background:linear-gradient(90deg,#b9bcc2,#7b7e85);border-radius:6px}
.card{position:absolute;z-index:8;background:#fff;border-radius:56px;box-shadow:0 50px 100px rgba(6,16,30,.38),0 12px 28px rgba(6,16,30,.2)}
.cardimg{background-image:var(--shotc);background-repeat:no-repeat;border-radius:44px}
</style></head><body>
<div class="glow g1"></div><div class="glow g2"></div>
${brand}
<div class="text">${badge}<div class="kicker">${escapeHtml(kicker)}</div><h1>${richTitle(title)}</h1><p class="sub">${escapeHtml(sub)}</p></div>
${phones}
${floating}
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
      const cardPath = screen.card?.source ? join(HERE, "raw", locale, `${screen.card.source}.png`) : null;
      const cardImage = cardPath && existsSync(cardPath) ? readFileSync(cardPath).toString("base64") : null;
      await page.setContent(html({ ...screen[locale], theme: screen.theme, layout: screen.layout, cardSpec: screen.card, image, cardImage, first: i === 0, pill: i === 0 ? PILL[locale] : null }), { waitUntil: "load" });
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
