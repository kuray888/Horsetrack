/**
 * Garde-fou vétérinaire du coach — logique pure, testée (safety.test.ts).
 *
 * Le coach ne donne JAMAIS d'avis médical. Deux filets :
 * 1. avant l'appel : une question qui évoque un symptôme (boiterie, colique,
 *    fièvre, plaie…) ou demande un traitement reçoit directement « appelle
 *    ton vétérinaire », sans passer par l'IA ;
 * 2. après l'appel : une réponse qui parle de médicament, de dose ou de
 *    diagnostic est remplacée par ce même message.
 *
 * Les soins de routine (vermifuge, vaccin, maréchal, dépenses véto, « dose
 * de vermifuge »…) ne déclenchent rien : ce sont des questions sur le
 * carnet, pas des symptômes.
 */

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Symptômes et demandes de soin, en français et en anglais. */
const SYMPTOM_PATTERNS: RegExp[] = [
  // Boiterie
  /\bboit(e|ent|ait|erie|eux|euse)\b/,
  /\b(lame|lameness|limp(s|ing)?)\b/,
  // Coliques, digestion
  /\bcolique/,
  /\bcolic/,
  /\b(ne|n') ?(mange|boit) (plus|pas|rien)\b/,
  /\b(off (his|her|its) feed|not eating|won'?t eat|stopped eating)\b/,
  /\bse roule\b/,
  // Fièvre
  /\bfi[e]vre\b/,
  /\bfever\b/,
  /\btemperature (de|a|elevee|haute)\b|\bhigh temperature\b/,
  // Plaies, saignements, gonflements
  /\bplaie/,
  /\b(saign|hemorrag)/,
  /\b(bleed|bleeding|wound|cut on|gash)\b/,
  // « boules? » en mot entier : « boulet » (articulation) n'est pas un symptôme.
  /\b(gonfl|enfl|oedem|œdem|abces|bosse|molette)|\bboules?\b/,
  /\b(swollen|swelling|abscess|lump|heat in (the|his|her) (leg|hoof|foot))\b/,
  /\bchaleur (au|aux|dans|sur) (pied|pieds|membre|membres|tendon|jambe)/,
  // Respiration
  /\b(tousse|toux|jetage|morve|essouffl)/,
  /\b(cough|coughing|nasal discharge|snot)\b/,
  // Comportement inquiétant
  /\b(couche|allonge) (et|qui) ne se releve/,
  /\b(won'?t get up|lying down and)\b/,
  /\b(sue|transpire) (beaucoup|anormalement|sans raison)/,
  // Demandes de traitement
  // Préfixes sans \b final : pluriels et dérivés (« antibiotiques », « corticoïdes »).
  /\b(medicament|antibio|anti-?inflammatoire|phenylbutazone|equipalazone|cortico|posologie)/,
  /\b(traitement pour|soigner|guerir)\b/,
  /\b(medication|medicine|antibiotic|anti-?inflammator|phenylbutazone|diagnos)/,
  /\b(bute|how (do i|to|should i) treat|cure)\b/,
  /\b(what does (he|she|it) have|qu'?est-ce qu'?il a)\b/,
];

export function mentionsSymptom(text: string): boolean {
  const t = fold(text);
  return SYMPTOM_PATTERNS.some((re) => re.test(t));
}

/** Mots qu'une réponse du coach ne doit jamais contenir. */
const MEDICAL_ADVICE_PATTERNS: RegExp[] = [
  /\b(medicament|antibio|anti-?inflammatoire|phenylbutazone|cortico|posologie|diagnosti|medication|antibiotic|anti-?inflammator|diagnos)/,
  /\b(injection de|il souffre de|il a probablement|bute|probably has|suffers from)\b/,
];

export function containsMedicalAdvice(text: string): boolean {
  const t = fold(text);
  return MEDICAL_ADVICE_PATTERNS.some((re) => re.test(t));
}

export function vetMessage(lang: "fr" | "en"): string {
  return lang === "en"
    ? "This sounds like a health problem, and I can't give medical advice. Call your vet. In an emergency (colic, bleeding, a horse lying down that won't get up), call them right away."
    : "Ça ressemble à un problème de santé, et je ne peux pas donner d'avis médical. Appelle ton vétérinaire. En cas d'urgence (colique, saignement, cheval couché qui ne se relève pas), appelle-le tout de suite.";
}
