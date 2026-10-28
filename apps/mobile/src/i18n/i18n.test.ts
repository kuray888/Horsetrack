import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EN } from "@/i18n/en";
import { interpolate, translate } from "@/i18n";
import {
  HEALTH_CONDITIONS,
  HORSE_TEMPERAMENTS,
  HORSE_TRAITS,
  INJURY_TYPES,
  OTHER_OPTION,
  REST_DAY_ACTIVITIES,
} from "@/onboarding/options";

const ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
  });
}

/** Chaînes passées à t() / tr() dans le code (littéraux uniquement). */
function translatedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const re = /\b(?:t|tr)\(\s*("(?:[^"\\]|\\.)*")/g;
  for (const file of [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "src"))]) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(re)) keys.set(JSON.parse(m[1]) as string, path.relative(ROOT, file));
  }
  return keys;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("traduction anglaise", () => {
  const keys = translatedKeys();

  it("trouve les textes de l'app", () => {
    expect(keys.size).toBeGreaterThan(1000);
  });

  it("chaque texte du code a sa traduction", () => {
    const missing = [...keys].filter(([k]) => !(k in EN)).map(([k, file]) => `${file} : ${JSON.stringify(k)}`);
    expect(missing).toEqual([]);
  });

  // L'anglais peut se passer d'un paramètre (un accord du français, « {v} »
  // pour le « s » d'un participe), jamais en inventer un.
  it("aucune traduction n'utilise un paramètre inconnu", () => {
    const wrong = Object.entries(EN)
      .filter(([fr, en]) => placeholders(en).some((p) => !placeholders(fr).includes(p)))
      .map(([fr, en]) => `${fr} → ${en}`);
    expect(wrong).toEqual([]);
  });

  it("aucune traduction vide ni restée en français par oubli", () => {
    const empty = Object.entries(EN).filter(([, en]) => !en.trim() || /[éèêàçù]/.test(en) && !/Horsetrack|Selle|Pur-sang/.test(en));
    expect(empty.map(([fr]) => fr)).toEqual([]);
  });
});

// Valeurs ENREGISTRÉES en français (identiques pour tous les utilisateurs d'un
// cheval partagé), traduites seulement à l'affichage : t(valeur).
describe("valeurs enregistrées", () => {
  it("ont toutes leur traduction d'affichage", () => {
    const stored = [
      ...HORSE_TRAITS,
      ...REST_DAY_ACTIVITIES,
      ...HORSE_TEMPERAMENTS,
      ...HEALTH_CONDITIONS,
      ...INJURY_TYPES.map((i) => i.value).filter((v) => v !== OTHER_OPTION),
    ];
    expect(stored.filter((v) => !(v in EN))).toEqual([]);
  });
});

describe("t()", () => {
  it("remplace les paramètres", () => {
    expect(interpolate("{n} séances avec {name}", { n: 3, name: "Éclair" })).toBe("3 séances avec Éclair");
    expect(interpolate("{inconnu}", {})).toBe("{inconnu}");
  });

  it("anglais si traduit, sinon le français plutôt qu'une clé", () => {
    expect(translate("en", "Annuler")).toBe(EN["Annuler"]);
    expect(translate("en", "texte jamais traduit")).toBe("texte jamais traduit");
    expect(translate("fr", "Annuler")).toBe("Annuler");
  });
});
