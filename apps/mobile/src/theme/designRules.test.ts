import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fous du système de design (CLAUDE.md § Design) : ces règles se
 * vérifiaient à la relecture, et dérivaient. Chaque exception est listée avec
 * sa raison ; une nouvelle occurrence fait échouer le test.
 */

const ROOT = path.resolve(__dirname, "../..");

function screenFiles(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
        out.push({ rel: path.relative(ROOT, p), src: fs.readFileSync(p, "utf8") });
      }
    }
  };
  walk(path.join(ROOT, "app"));
  walk(path.join(ROOT, "src"));
  return out.filter((f) => !f.rel.startsWith("src/theme/"));
}

/** Retire les commentaires : un exemple cité dans un commentaire n'est pas un usage. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function count(re: RegExp): Map<string, number> {
  const found = new Map<string, number>();
  for (const f of screenFiles()) {
    const n = code(f.src).match(re)?.length ?? 0;
    if (n > 0) found.set(f.rel, n);
  }
  return found;
}

/** Échoue si un fichier dépasse ce que l'exception autorise. */
function expectWithin(found: Map<string, number>, allowed: Record<string, number>, byDefault = 0) {
  const over = [...found].filter(([file, n]) => n > (allowed[file] ?? byDefault)).map(([file, n]) => `${file} (${n})`);
  expect(over, "Nouvelle occurrence : utiliser un jeton du thème, ou justifier l'exception ici").toEqual([]);
}

const FILES = screenFiles();

describe("système de design", () => {
  it("le scan voit bien les écrans", () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.some((f) => f.rel === "app/(tabs)/today.tsx")).toBe(true);
  });

  it("aucune couleur hexadécimale ou rgba en dur hors du thème", () => {
    expectWithin(count(/["'`]#[0-9a-fA-F]{3,8}["'`]|rgba?\(\s*\d/g), {
      // Texte blanc et voile noir posés sur la photo du cheval : indépendants du thème.
      "src/horses/components/HorseBanner.tsx": 4,
      // Visionneuse plein écran sur fond noir, comme Photos.
      "app/document-viewer.tsx": 1,
      // Pastille de l'interrupteur iOS : blanche dans toutes les apps.
      "app/(tabs)/profile.tsx": 1,
      // Anneau sur la carte bg-primary : textOnPrimary vaut blanc dans toutes les palettes.
      "app/(tabs)/planning.tsx": 1,
      // Image partagée en story : couleurs de la marque, identiques quel que soit le thème choisi.
      "src/rides/components/RideShareCard.tsx": 9,
    });
  });

  it("aucune couleur Tailwind brute (text-red-500, bg-gray-100…)", () => {
    expectWithin(
      count(/\b(?:text|bg|border)-(?:red|green|blue|gray|slate|zinc|neutral|stone|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|orange)-\d{2,3}\b/g),
      {}
    );
    // Noir et blanc seulement pour les voiles et la photo, jamais pour du contenu.
    expectWithin(count(/\b(?:text|bg|border)-(?:white|black)\b/g), {
      "app/document-viewer.tsx": 4,
      "src/agenda/components/JournalVideo.tsx": 1,
      "src/components/PickerOverlay.tsx": 1,
      "src/components/QuickAddSheet.tsx": 1,
      "src/glossary/GlossaryProvider.tsx": 1,
      "src/horses/components/HorseBanner.tsx": 6,
    });
  });

  it("les photos passent par AppImage (cache + fondu), pas par l'Image de react-native", () => {
    expectWithin(count(/import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*["']react-native["']/g), {
      // Logo embarqué dans l'app : aucune photo à mettre en cache.
      "src/components/BrandMark.tsx": 1,
    });
  });

  it("aucun emoji décoratif dans l'interface", () => {
    expectWithin(count(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu), {
      // 🐴 dans les messages envoyés à d'autres personnes (partage, invitation,
      // carte de l'année) : texte hors de l'app, gardé volontairement.
      "app/share-horse-modal.tsx": 1,
      "app/horse/[id]/annee.tsx": 1,
      "src/horses/store.tsx": 2,
    });
  });

  it("un seul text-3xl par écran", () => {
    const found = count(/\btext-3xl\b/g);
    expectWithin(found, {
      // Carte « Mon année » à partager : nom du cheval et chiffres en affiche.
      "app/horse/[id]/annee.tsx": 2,
    }, 1);
    // ScreenTitle porte déjà le text-3xl de l'écran.
    const withTitle = FILES.filter((f) => /<ScreenTitle\b/.test(f.src) && /\btext-3xl\b/.test(code(f.src)));
    expect(withTitle.map((f) => f.rel)).toEqual([]);
  });

  it("grille 4/8 : les valeurs « entre-deux » ne peuvent que diminuer", () => {
    // gap-1.5, p-3.5, mt-2.5… : à corriger quand on retouche l'écran.
    // Baisser ce plafond à chaque correction ; ne jamais le monter.
    const PLAFOND = 182;
    const total = [...count(/\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(?:0\.5|1\.5|2\.5|3\.5)\b/g).values()].reduce(
      (a, b) => a + b,
      0
    );
    expect(total).toBeLessThanOrEqual(PLAFOND);
  });
});
