/**
 * Visuels App Store à partir des captures brutes (raw/<langue>/*.png) :
 * out/<langue>/<jeu>/NN-<écran>.png en 1290 × 2796, plus out/index.html pour
 * tout relire d'un coup d'œil. Usage : npm run setup (une fois), npm run render.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { LOCALES, PILL, RATING, SCREENS, SETS, SIZE } from "./screens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "../../node_modules/@expo-google-fonts/bricolage-grotesque");
const ICONS = join(HERE, "../../node_modules/@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf");

// Palette de l'app et du site : marine, bleu, ciel, cuivre, crème. Chaque thème
// a un dégradé discret (deux tons de la même couleur, jamais de violet).
const THEMES = {
  navy: { stk: "#336195", laurel: "#a3cef1", bg: "linear-gradient(165deg,#336195 0%,#274c77 45%,#16304f 100%)", title: "#ffffff", sub: "#d5e5f3", acc: "#a3cef1", kick: "#a3cef1", glow: "#4a7fb3", glow2: "#16304f", chip: "#a3cef1", chipText: "#e8f3fc", pill: "#a3cef1", pillText: "#17385c" },
  blue: { stk: "#1d6fb8", laurel: "#ffe3bd", bg: "linear-gradient(165deg,#3a93d6 0%,#2378bd 45%,#175a93 100%)", title: "#ffffff", sub: "#e4f1fb", acc: "#ffe3bd", kick: "#d2e8f9", glow: "#63aee8", glow2: "#164f82", chip: "#ffffff", chipText: "#ffffff", pill: "#ffffff", pillText: "#1d6fb8" },
  sky: { stk: "#274c77", laurel: "#a35a36", bg: "linear-gradient(165deg,#c4e1f7 0%,#a3cef1 45%,#7fb6e3 100%)", title: "#17385c", sub: "#2f5278", acc: "#a35a36", kick: "#274c77", glow: "#e0f0fc", glow2: "#6aa6d9", chip: "#274c77", chipText: "#17385c", pill: "#274c77", pillText: "#ffffff" },
  copper: { stk: "#8d4e2c", laurel: "#ffe0c4", bg: "linear-gradient(165deg,#cc8059 0%,#b66b45 45%,#8d4e2c 100%)", title: "#ffffff", sub: "#fdeee2", acc: "#ffe0c4", kick: "#ffe0c4", glow: "#e09a74", glow2: "#7c4222", chip: "#ffe9d6", chipText: "#ffffff", pill: "#fff4ec", pillText: "#8a4a2a" },
  cream: { stk: "#274c77", laurel: "#b66b45", bg: "linear-gradient(165deg,#fbf8f1 0%,#f1ece2 45%,#e4dac6 100%)", title: "#274c77", sub: "#4d6178", acc: "#b66b45", kick: "#a35a36", glow: "#ffffff", glow2: "#d9ccb4", chip: "#274c77", chipText: "#274c77", pill: "#274c77", pillText: "#ffffff" },
};

function font(weight, file) {
  const path = join(FONTS, file);
  if (!existsSync(path)) throw new Error(`Police introuvable : ${path} (lancer pnpm install à la racine)`);
  return `@font-face{font-family:Bricolage;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(path).toString("base64")})}`;
}
const FONT_CSS = font(800, "800ExtraBold/BricolageGrotesque_800ExtraBold.ttf") + font(500, "500Medium/BricolageGrotesque_500Medium.ttf");
const ICON_CSS = `@font-face{font-family:MS;src:url(data:font/ttf;base64,${readFileSync(ICONS).toString("base64")})}
.ms{font-family:MS;font-weight:400;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;font-feature-settings:"liga";-webkit-font-feature-settings:"liga"}`;
const LOGO = `data:image/png;base64,${readFileSync(join(HERE, "../../apps/mobile/assets/logo-mark.png")).toString("base64")}`;

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** « mot **souligné** » → <span class="hl">. */
const richTitle = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>');

// Capture brute : 1320 × 2868 (iPhone 17 Pro Max).
const RAW = { w: 1320, h: 2868 };

const place = ({ x, y, rx = 0, ry = 0, rz = 0, tz = 0 }) =>
  `left:${x}px;top:${y}px;transform:translate3d(0,0,${tz}px) rotateZ(${rz}deg) rotateY(${ry}deg) rotateX(${rx}deg)`;

/** Un iPhone en 3D : face avant (anneau en titane, lunette, écran, Dynamic
 * Island, reflet) et tranche faite de calques empilés en profondeur. */
function phone(item) {
  const w = item.w;
  const ring = Math.round(w * 0.012);
  const bezel = Math.round(w * 0.022);
  const sw = w - 2 * (ring + bezel);
  const sh = Math.round((sw * RAW.h) / RAW.w);
  const outerR = Math.round(w * 0.17);
  const screenR = outerR - ring - bezel;
  const h = sh + 2 * (ring + bezel);
  const depth = Math.round(w * 0.05);
  let edges = "";
  for (let k = depth; k >= 3; k -= 3) {
    const shade = 120 + Math.round(((depth - k) / depth) * 60);
    edges += `<i class="edge" style="border-radius:${outerR}px;background:rgb(${shade},${shade + 2},${shade + 8});transform:translateZ(${-k}px)"></i>`;
  }
  const btn = (side, top, hh) =>
    `<i class="btn" style="${side}:${-Math.round(w * 0.011)}px;top:${Math.round(h * top)}px;height:${Math.round(h * hh)}px;width:${Math.round(w * 0.02)}px;transform:translateZ(${-Math.round(depth / 2)}px)"></i>`;
  return `<div class="p3d" style="${place(item)};width:${w}px;height:${h}px">
    <i class="edge shadowlayer" style="border-radius:${outerR}px;transform:translateZ(${-depth - 4}px)"></i>
    ${edges}${btn("left", 0.13, 0.035)}${btn("left", 0.2, 0.07)}${btn("left", 0.285, 0.07)}${btn("right", 0.24, 0.11)}
    <div class="face" style="border-radius:${outerR}px;padding:${ring}px">
      <div class="bezel" style="padding:${bezel}px;border-radius:${outerR - ring}px">
        <div class="screen" style="width:${sw}px;height:${sh}px;border-radius:${screenR}px">
          <div class="shot s-${item.p}"></div>
          <div class="island" style="top:${Math.round(sw * 0.021)}px;width:${Math.round(sw * 0.285)}px;height:${Math.round(sw * 0.085)}px"></div>
          <div class="glass"></div>${item.tz < 0 ? '<div class="dim"></div>' : ""}
        </div>
      </div>
    </div>
  </div>`;
}

/** Une carte découpée dans une capture, qui flotte en avant du téléphone. */
function card(item) {
  const [cx, cy, cw, ch] = item.crop;
  const pad = 14;
  const iw = item.w - 2 * pad;
  const sc = iw / cw;
  const ih = Math.round(ch * sc);
  return `<div class="card" style="${place(item)};width:${item.w}px;height:${ih + 2 * pad}px;padding:${pad}px">
    <div class="cardimg s-${item.c}" style="width:${iw}px;height:${ih}px;background-size:${Math.round(RAW.w * sc)}px auto;background-position:${-Math.round(cx * sc)}px ${-Math.round(cy * sc)}px"></div>
  </div>`;
}


/** Étincelle à quatre branches. */
const sparkle = ({ x, y, s }, color) =>
  `<svg class="deco" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px" viewBox="0 0 24 24"><path fill="${color}" d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"/></svg>`;

/** Flèche tracée à la main (courbe + pointe). */
const arrow = ({ x, y, w, h, rot = 0 }, color) =>
  `<svg class="deco" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg)" viewBox="0 0 200 150" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20C70 -6 150 20 182 112"/><path d="M158 96L183 118L196 86"/></svg>`;

/** Autocollant : pastille blanche, icône dans un rond de couleur, légende. */
const sticker = ({ icon, label, x, y, rot = 0 }, c) =>
  `<div class="sticker" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)"><span class="stk-ico" style="background:${c.stk}"><i class="ms">${icon}</i></span><span class="stk-txt">${escapeHtml(label)}</span></div>`;

/** Médaille de laurier avec la note : deux branches de vraies feuilles
 * pointues, posées le long d'un arc, un peu ouvertes vers l'extérieur. */
function laurel({ x, y, s }, locale, c) {
  const leaf = "M0 0C9 -10 9 -30 0 -50C-9 -30 -9 -10 0 0Z";
  let left = "";
  const R = 118;
  for (let i = 0; i < 10; i++) {
    const a = ((98 + i * 17) * Math.PI) / 180; // du bas vers le haut, côté gauche
    const px = 150 + R * Math.cos(a);
    const py = 150 + R * Math.sin(a);
    const tx = -Math.sin(a), ty = Math.cos(a); // sens de la branche (vers le haut)
    const ox = Math.cos(a), oy = Math.sin(a); // vers l'extérieur
    for (const [tilt, len] of [[34, 1], [-34, 0.82]]) {
      const t = (tilt * Math.PI) / 180;
      const dx = tx * Math.cos(t) + ox * Math.sin(t);
      const dy = ty * Math.cos(t) + oy * Math.sin(t);
      const phi = (Math.atan2(dx, -dy) * 180) / Math.PI;
      left += `<path d="${leaf}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${phi.toFixed(1)}) scale(${len})"/>`;
    }
  }
  const star = `<path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9z"/>`;
  const stars = Array.from({ length: 5 }, (_, i) => `<g transform="translate(${73 + i * 30} 184) scale(1.1)">${star}</g>`).join("");
  return `<svg class="deco" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px" viewBox="0 0 300 300">
    <g fill="${c.laurel}">${left}<g transform="translate(300 0) scale(-1 1)">${left}</g></g>
    <text x="150" y="172" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="88" fill="${c.title}" letter-spacing="-2">${escapeHtml(RATING.score[locale])}</text>
    <g fill="${c.laurel}">${stars}</g>
    <text x="150" y="232" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="22" fill="${c.title}" letter-spacing="1">${escapeHtml(RATING.count[locale].toUpperCase())}</text>
  </svg>`;
}

function html({ kicker, title, sub, chips = [], pill, theme, scene, images, first, icon, stickers = [], arrows = [], sparkles = [], badge, kind, features = [], cta, locale, noKicker }) {
  const c = THEMES[theme];
  const brand = first ? `<div class="brand"><img src="${LOGO}"/><span>Horsetrack</span></div>` : "";
  const pillHtml = pill ? `<div class="pill">${escapeHtml(pill)}</div>` : "";
  const chipsHtml = chips.length ? `<div class="chips">${chips.map((x) => `<span>${escapeHtml(x)}</span>`).join("")}</div>` : "";
  const top = first ? 250 : 170;
  const shotCss = Object.entries(images).map(([name, b64]) => `.s-${name}{background-image:url(data:image/png;base64,${b64})}`).join("\n");
  const items = scene.map((it) => (it.p ? phone(it) : card(it))).join("\n");
  const deco = [
    ...sparkles.map((x) => sparkle(x, c.acc)),
    ...arrows.map((x) => arrow(x, c.acc)),
    badge ? laurel(badge, locale, c) : "",
    ...stickers.map((x) => sticker(x, c)),
  ].join("\n");
  const grid =
    kind === "closing"
      ? `<div class="grid">${features.map((f) => `<div class="tile"><span class="stk-ico" style="background:${c.stk}"><i class="ms">${f.icon}</i></span><span>${escapeHtml(f[locale])}</span></div>`).join("")}</div><div class="cta">${escapeHtml(cta)}</div>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
${ICON_CSS}
${shotCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden}
body{background:${c.bg};font-family:Bricolage,sans-serif;position:relative}
.glow{position:absolute;border-radius:50%}
.g1{width:1500px;height:1500px;right:-700px;top:620px;background:radial-gradient(circle,${c.glow} 0%,transparent 68%);opacity:.75}
.g2{width:1100px;height:1100px;left:-520px;top:1700px;background:radial-gradient(circle,${c.glow2} 0%,transparent 70%);opacity:.8}
.ring1{position:absolute;width:1300px;height:1300px;border-radius:50%;border:3px solid ${c.kick};opacity:.18;left:-260px;top:1350px}
.ring2{position:absolute;width:900px;height:900px;border-radius:50%;border:3px solid ${c.kick};opacity:.14;right:-380px;top:880px}
.brand{position:absolute;top:96px;left:96px;display:flex;align-items:center;gap:24px;color:${c.title};font-weight:800;font-size:54px;letter-spacing:-1px;z-index:6}
.brand img{width:92px;height:92px;border-radius:24px;background:#fff;padding:14px}
.text{position:absolute;top:${top}px;left:96px;right:96px;z-index:6}
.kicker{display:inline-flex;align-items:center;gap:16px;color:${c.kick};font-weight:800;font-size:34px;letter-spacing:5px;text-transform:uppercase;margin-bottom:36px;border:4px solid ${c.kick};border-radius:999px;padding:8px 30px 8px 12px}
.kicker .ms{font-size:44px;background:${c.kick};color:${c.stk};border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center}
.deco{position:absolute;z-index:9;overflow:visible}
.sticker{position:absolute;z-index:9;display:flex;align-items:center;gap:20px;background:#fff;border-radius:999px;padding:14px 38px 14px 14px;box-shadow:0 30px 60px rgba(6,16,30,.3),0 8px 18px rgba(6,16,30,.18);color:#17385c;font-weight:800;font-size:38px;letter-spacing:-.5px}
.stk-ico{display:flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:50%;color:#fff;flex:none}
.stk-ico .ms{font-size:52px}
.grid{position:absolute;left:96px;right:96px;top:900px;display:grid;grid-template-columns:1fr 1fr;gap:28px;z-index:6}
.tile{display:flex;align-items:center;gap:22px;background:rgba(255,255,255,.96);border-radius:48px;padding:22px 30px 22px 22px;color:#17385c;font-weight:800;font-size:40px;letter-spacing:-.8px;box-shadow:0 30px 60px rgba(4,12,24,.3)}
.cta{position:absolute;left:96px;right:96px;bottom:150px;text-align:center;background:${c.pill};color:${c.pillText};font-weight:800;font-size:58px;letter-spacing:-1px;padding:44px 0;border-radius:999px;box-shadow:0 30px 60px rgba(4,12,24,.35);z-index:6}
.pill{display:inline-block;background:${c.pill};color:${c.pillText};font-weight:800;font-size:40px;padding:16px 36px;border-radius:999px;margin-bottom:36px}
h1{color:${c.title};font-weight:800;font-size:122px;line-height:1.01;letter-spacing:-3px;white-space:pre-line}
.hl{color:${c.acc};position:relative;white-space:nowrap}
.hl::after{content:"";position:absolute;left:-4px;right:-4px;bottom:-10px;height:14px;border-radius:8px;background:${c.acc};opacity:.55;transform:rotate(-1.2deg)}
p.sub{color:${c.sub};font-weight:500;font-size:46px;line-height:1.3;margin-top:50px;max-width:1000px}
.chips{display:flex;flex-wrap:wrap;gap:16px;margin-top:40px}
.chips span{color:${c.chipText};border:4px solid ${c.chip};border-radius:999px;padding:10px 30px;font-weight:800;font-size:38px;letter-spacing:.5px}
.scene{position:absolute;inset:0;perspective:2600px;perspective-origin:50% 62%;transform-style:preserve-3d}
.p3d{position:absolute;transform-style:preserve-3d}
.edge{position:absolute;inset:0}
.shadowlayer{background:#0b1522;box-shadow:0 120px 180px rgba(4,12,24,.5),0 30px 60px rgba(4,12,24,.35)}
.face{position:absolute;inset:0;background:linear-gradient(135deg,#eceef1 0%,#a2a5ab 28%,#dcdee2 52%,#80838a 78%,#cfd2d6 100%)}
.bezel{background:#05070a;height:100%;position:relative}
.screen{position:relative;overflow:hidden;background:#e7ecef}
.shot{position:absolute;inset:0;background-size:100% 100%}
.island{position:absolute;left:50%;transform:translateX(-50%);background:#000;border-radius:999px}
.dim{position:absolute;inset:0;background:rgba(6,16,30,.22)}
.glass{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.2) 0%,rgba(255,255,255,0) 34%)}
.btn{position:absolute;background:linear-gradient(90deg,#b9bcc2,#7b7e85);border-radius:6px}
.card{position:absolute;background:#fff;border-radius:56px;box-shadow:0 60px 110px rgba(6,16,30,.42),0 14px 30px rgba(6,16,30,.22)}
.cardimg{background-repeat:no-repeat;border-radius:44px}
</style></head><body>
<div class="glow g1"></div><div class="glow g2"></div><div class="ring1"></div><div class="ring2"></div>
${brand}
<div class="text">${pillHtml}${noKicker ? "" : `<div class="kicker"><i class="ms">${icon ?? "pets"}</i>${escapeHtml(kicker)}</div>`}<h1>${richTitle(title)}</h1><p class="sub">${escapeHtml(sub)}</p>${chipsHtml}</div>
<div class="scene">${items}</div>
${deco}
${grid}
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
      const images = {};
      for (const name of new Set(screen.scene.map((it) => it.p ?? it.c))) {
        const rawPath = join(HERE, "raw", locale, `${name}.png`);
        if (existsSync(rawPath)) images[name] = readFileSync(rawPath).toString("base64");
        else {
          missing++;
          console.warn(`! capture manquante : raw/${locale}/${name}.png`);
        }
      }
      await page.setContent(html({ ...screen[locale], theme: screen.theme, scene: screen.scene, images, first: i === 0, pill: i === 0 ? PILL[locale] : null, icon: screen.icon, stickers: screen.stickers, arrows: screen.arrows, sparkles: screen.sparkles, badge: screen.badge, kind: screen.kind, features: screen.features, locale, noKicker: screen.noKicker }), { waitUntil: "load" });
      const file = join(dir, `${String(i + 1).padStart(2, "0")}-${id}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, ...SIZE } });
      row.push(relative(join(HERE, "out"), file));
    }
    index.push({ locale, setName, row });
  }
}

// La médaille seule (PNG transparent), pour d'autres usages : site, réseaux…
for (const locale of LOCALES) {
  for (const [name, theme] of [["sombre", "navy"], ["clair", "cream"]]) {
    const c = THEMES[theme];
    const dir = join(HERE, "out", "badge");
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 800, height: 800 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONT_CSS}html,body{margin:0;background:transparent;width:800px;height:800px}.deco{position:absolute}</style>${laurel({ x: 0, y: 0, s: 800 }, locale, c)}`, { waitUntil: "load" });
    await page.screenshot({ path: join(dir, `note-${name}-${locale}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 800, height: 800 } });
  }
}
await page.setViewportSize(SIZE);
await browser.close();

writeFileSync(
  join(HERE, "out", "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Visuels App Store</title>
<style>body{font-family:system-ui;margin:24px;background:#f4f6f8}h2{margin:32px 0 12px}
.row{display:flex;gap:12px;overflow-x:auto}.row img{height:420px;border-radius:12px}</style>
${index.map(({ locale, setName, row }) => `<h2>${locale.toUpperCase()} · jeu « ${setName} »</h2><div class="row">${row.map((f) => `<img src="${f}">`).join("")}</div>`).join("\n")}`
);
console.log(`Terminé : ${index.length} jeux dans out/ (aperçu : out/index.html)${missing ? `, ${missing} capture(s) manquante(s)` : ""}.`);
