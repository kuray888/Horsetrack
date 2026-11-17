import { EN } from "@/i18n/en";
import { LANG_PREF_KEY, localeFor, parseLangPreference, resolveLang, type Lang } from "@/i18n/langs";

export type { Lang } from "@/i18n/langs";

/**
 * Traduction de l'app : le texte français reste écrit tel quel dans le code,
 * enveloppé dans `t()`, et sert de clé au dictionnaire anglais (i18n/en.ts).
 * Un écran se lit donc toujours en français dans le code, et un texte oublié
 * dans le dictionnaire s'affiche en français plutôt qu'en clé illisible.
 * i18n.test.ts vérifie que chaque `t("…")` du code a sa traduction.
 *
 * Langue : celle choisie dans Profil → Langue (i18n/langs.ts), sinon celle du
 * téléphone (ou celle choisie pour l'app dans Réglages → Horsetrack → Langue
 * sur iOS). Fixée au démarrage : le choix s'applique à la réouverture de l'app
 * (des textes sont construits à l'import, un changement à chaud en laisserait
 * dans l'ancienne langue). Français si le téléphone est en français, anglais
 * pour toutes les autres langues.
 *
 * Paramètres : `t("{n} séances", { n: 3 })`. Les pluriels se choisissent dans
 * le code, une chaîne par forme (le français et l'anglais ne s'accordent pas
 * toujours au même endroit).
 */

/** Choix mémorisé dans le trousseau, lu de façon synchrone : le module
 * expo-secure-store n'est chargé qu'ici, après la garde des tests. */
function storedPreference(): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("expo-secure-store") as typeof import("expo-secure-store")).getItem(LANG_PREF_KEY);
  } catch {
    return null;
  }
}

function detectLang(): Lang {
  // Tests : le français, langue de référence des attentes.
  if (typeof process !== "undefined" && process.env?.VITEST) return "fr";
  try {
    const device = Intl.DateTimeFormat().resolvedOptions().locale ?? "fr";
    return resolveLang(parseLangPreference(storedPreference()), device);
  } catch {
    return "fr";
  }
}

export const LANG: Lang = detectLang();

/** Pour Intl et toLocaleDateString (cf. langs.ts). */
export const LOCALE = localeFor(LANG);

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

/** Même texte français, deux sens en anglais (« Annuler » : Cancel d'une
 * alerte, Undo d'un toast). Le dictionnaire porte la clé « contexte|texte » ;
 * le français affiché reste `fr`. Vérifié par i18n.test.ts comme t(). */
export function translateInContext(lang: Lang, context: string, fr: string, params?: Record<string, string | number>): string {
  if (lang === "fr") return interpolate(fr, params);
  return interpolate(EN[`${context}|${fr}`] ?? EN[fr] ?? fr, params);
}

export function tc(context: string, fr: string, params?: Record<string, string | number>): string {
  return translateInContext(LANG, context, fr, params);
}
