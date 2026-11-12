/**
 * Téléphones seuls, vus de face, sur fond transparent, pour le site vitrine
 * (apps/web/src/assets/screens/*.webp), à partir des captures brutes
 * raw/fr/*.png. Même cadre d'iPhone que les visuels App Store (render.mjs),
 * sans perspective ni titre : le site pose ses propres fonds et textes.
 *
 *   node site-phones.mjs        (puis le WebP est écrit par sharp, cf. bas)
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out", "site");
mkdirSync(OUT, { recursive: true });

// Capture brute → nom du fichier sur le site.
const SITE = {
  today: "accueil",
  coach: "coach",
  ride: "seance-direct",
  "ride-setup": "seance-direct-depart",
  planning: "planning",
  journal: "journal",
  hub: "fiche-cheval",
  partage: "partage",
  budget: "budget",
};

const RAW = { w: 1320, h: 2868 };
const W = 960; // largeur du téléphone
const PAD = 48; // marge pour l'ombre portée
const ring = Math.round(W * 0.012);
const bezel = Math.round(W * 0.022);
const sw = W - 2 * (ring + bezel);
const sh = Math.round((sw * RAW.h) / RAW.w);
const outerR = Math.round(W * 0.17);
const screenR = outerR - ring - bezel;
const H = sh + 2 * (ring + bezel);

const html = (b64) => `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
.wrap{position:absolute;left:${PAD}px;top:${PAD}px;width:${W}px;height:${H}px}
.face{position:absolute;inset:0;border-radius:${outerR}px;padding:${ring}px;
  background:linear-gradient(135deg,#eceef1 0%,#a2a5ab 28%,#dcdee2 52%,#80838a 78%,#cfd2d6 100%);
  box-shadow:0 30px 60px rgba(6,16,30,.22),0 8px 18px rgba(6,16,30,.14)}
.bezel{background:#05070a;height:100%;box-sizing:border-box;padding:${bezel}px;border-radius:${outerR - ring}px}
.screen{position:relative;overflow:hidden;width:${sw}px;height:${sh}px;border-radius:${screenR}px;background:#e7ecef}
.shot{position:absolute;inset:0;background:url(data:image/png;base64,${b64}) 0 0/100% 100%}
.island{position:absolute;left:50%;transform:translateX(-50%);top:${Math.round(sw * 0.021)}px;width:${Math.round(sw * 0.285)}px;height:${Math.round(sw * 0.085)}px;background:#000;border-radius:999px}
.glass{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 34%)}
</style><div class="wrap"><div class="face"><div class="bezel"><div class="screen"><div class="shot"></div><div class="island"></div><div class="glass"></div></div></div></div></div>`;

const size = { width: W + 2 * PAD, height: H + 2 * PAD };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
for (const [raw, name] of Object.entries(SITE)) {
  const file = join(HERE, "raw", "fr", `${raw}.png`);
  if (!existsSync(file)) {
    console.warn(`! capture manquante : raw/fr/${raw}.png`);
    continue;
  }
  await page.setContent(html(readFileSync(file).toString("base64")), { waitUntil: "load" });
  await page.screenshot({ path: join(OUT, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, ...size } });
  console.log(`out/site/${name}.png`);
}
await browser.close();
