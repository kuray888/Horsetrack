import { EN } from "@/i18n/en";

/**
 * Traduction de l'app : le texte français reste écrit tel quel dans le code,
 * enveloppé dans `t()`, et sert de clé au dictionnaire anglais (i18n/en.ts).
 * Un écran se lit donc toujours en français dans le code, et un texte oublié
 * dans le dictionnaire s'affiche en français plutôt qu'en clé illisible.
 * i18n.test.ts vérifie que chaque `t("…")` du code a sa traduction.
 *
 * Langue : celle du téléphone (ou celle choisie pour l'app dans Réglages →
 * Horsetrack → Langue sur iOS), fixée au démarrage — changer de langue
 * relance l'app sur iOS. Français si le téléphone est en français, anglais
 * pour toutes les autres langues.
 *
 * Paramètres : `t("{n} séances", { n: 3 })`. Les pluriels se choisissent dans
 * le code, une chaîne par forme (le français et l'anglais ne s'accordent pas
 * toujours au même endroit).
 */

export type Lang = "fr" | "en";

function detectLang(): Lang {
  // Tests : le français, langue de référence des attentes.
  if (typeof process !== "undefined" && process.env?.VITEST) return "fr";
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "fr";
    return locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  } catch {
    return "fr";
  }
}

export const LANG: Lang = detectLang();

/** Pour Intl et toLocaleDateString : anglais britannique (jour avant le mois,
 * comme en français). */
export const LOCALE = LANG === "fr" ? "fr-FR" : "en-GB";

/** « 12.5 » → « 12,5 » en français, inchangé en anglais. */
export function localDecimal(text: string): string {
  return LANG === "fr" ? text.replace(".", ",") : text;
}

/** Remplace `{nom}` par la valeur correspondante. */
export function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

export function translate(lang: Lang, fr: string, params?: Record<string, string | number>): string {
  return interpolate(lang === "fr" ? fr : (EN[fr] ?? fr), params);
}

export function t(fr: string, params?: Record<string, string | number>): string {
  return translate(LANG, fr, params);
}
