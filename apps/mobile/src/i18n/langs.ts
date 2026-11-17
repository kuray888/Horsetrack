/**
 * Langues de l'app et choix de l'utilisateur. Logique pure, testée dans
 * langs.test.ts ; le reste de l'i18n est dans index.ts.
 *
 * Ajouter une langue : un dictionnaire (comme en.ts), une ligne dans
 * LANGUAGES et dans LOCALES, et sa déclaration à iOS (app.json
 * `CFBundleLocalizations`, locales/<code>.json).
 */

export type Lang = "fr" | "en";

/** Nom de chaque langue écrit dans cette langue (jamais traduit) : on doit
 * pouvoir retrouver la sienne même quand l'app est dans une langue qu'on ne lit pas. */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
];

/** Pour Intl et toLocaleDateString. L'anglais est britannique : jour avant le
 * mois, comme en français. */
const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

export function localeFor(lang: Lang): string {
  return LOCALES[lang];
}

/** « Automatique » suit le téléphone ; sinon la langue choisie dans le Profil. */
export type LangPreference = "auto" | Lang;

/** Clé du choix, gardée dans le trousseau : relue de façon synchrone au
 * démarrage, avant que les textes ne soient construits. */
export const LANG_PREF_KEY = "app_language_v1";

export function parseLangPreference(raw: unknown): LangPreference {
  return raw === "auto" || LANGUAGES.some((l) => l.code === raw) ? (raw as LangPreference) : "auto";
}

/** Langue gérée la plus proche d'une locale du téléphone (« fr-FR », « en_GB ») ;
 * l'anglais pour toutes les autres, comme avant le sélecteur. */
export function langFromLocale(locale: string): Lang {
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((l) => l.code === base)?.code ?? "en";
}

export function resolveLang(pref: LangPreference, deviceLocale: string): Lang {
  return pref === "auto" ? langFromLocale(deviceLocale) : pref;
}

const nameOf = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)?.name ?? lang;

/**
 * Libellé de la ligne « Langue » du Profil. `shown` : langue affichée en ce
 * moment ; `next` : celle que donnera le choix à la réouverture (par défaut
 * celle du choix lui-même). Les mots (« Automatique », « à la réouverture »)
 * viennent de l'appelant, qui les traduit.
 */
export function languageSummary(
  pref: LangPreference,
  shown: Lang,
  words: { auto: string; pending: string },
  next?: Lang
): string {
  const resolved = next ?? (pref === "auto" ? shown : pref);
  const base = pref === "auto" ? `${words.auto} · ${nameOf(resolved)}` : nameOf(pref);
  return resolved === shown ? base : `${base} · ${words.pending}`;
}
