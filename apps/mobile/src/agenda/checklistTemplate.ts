/**
 * Checklist type des concours : une liste de libellés que le cavalier édite une
 * fois et qui s'applique à tous ses concours à venir (et sert de départ aux
 * prochains).
 *
 * Module pur et sans dépendance, comme planning/planningDestination.ts :
 * testable sous Vitest sans passer par react-native (agenda/store.tsx ne l'est
 * pas). Chaque concours garde SA propre checklist (cf. Appointment.checklist,
 * sérialisée en JSON côté serveur) — la liste type n'est qu'un modèle qu'on
 * recopie dedans, jamais un lien vivant.
 */

export type ChecklistItemLike = { id: string; label: string; checked: boolean };

/** Liste d'origine, celle que recevait tout concours avant l'existence de la
 * checklist type. */
export const DEFAULT_CHECKLIST_LABELS: readonly string[] = [
  "Papiers d'identité du cheval (passeport)",
  "Carnet de vaccination à jour",
  "Licence FFE / engagement",
  "Matériel de pansage",
  "Tapis de selle + couvertures",
  "Protections (guêtres, cloches)",
  "Casque",
  "Gilet de protection",
  "Eau et nourriture pour la journée",
];

/** Plafond d'éléments : la liste est recopiée dans chaque concours à venir et
 * poussée telle quelle vers le cloud. */
export const MAX_CHECKLIST_ITEMS = 40;

function keyOf(label: string): string {
  return label.trim().toLowerCase();
}

/** Nettoie une liste saisie à la main : espaces retirés, lignes vides et
 * doublons (sans tenir compte de la casse) écartés, ordre conservé. */
export function normalizeChecklistLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    if (!label || seen.has(keyOf(label))) continue;
    seen.add(keyOf(label));
    out.push(label);
    if (out.length >= MAX_CHECKLIST_ITEMS) break;
  }
  return out;
}

/** Checklist neuve (rien de coché) pour un concours qu'on vient de créer. */
export function buildChecklist(labels: readonly string[], makeId: () => string): ChecklistItemLike[] {
  return normalizeChecklistLabels(labels).map((label) => ({ id: makeId(), label, checked: false }));
}

/** Aligne la checklist d'un concours sur une nouvelle liste type.
 *
 * - les éléments de la nouvelle liste sont là, dans son ordre ; ceux déjà
 *   présents gardent leur identifiant ET leur case cochée (on ne décoche
 *   jamais ce que le cavalier a déjà préparé) ;
 * - les éléments de l'ANCIENNE liste type retirés de la nouvelle disparaissent ;
 * - les éléments ajoutés à la main sur CE concours (ni dans l'ancienne liste ni
 *   dans la nouvelle) sont conservés, à la suite.
 *
 * La comparaison ignore casse et espaces autour, comme normalizeChecklistLabels. */
export function applyChecklistTemplate<T extends ChecklistItemLike>(
  current: readonly T[],
  previousTemplate: readonly string[],
  nextTemplate: readonly string[],
  makeId: () => string
): ChecklistItemLike[] {
  const next = normalizeChecklistLabels(nextTemplate);
  const nextKeys = new Set(next.map(keyOf));
  const previousKeys = new Set(previousTemplate.map(keyOf));
  const existingByKey = new Map<string, T>();
  for (const item of current) if (!existingByKey.has(keyOf(item.label))) existingByKey.set(keyOf(item.label), item);

  const fromTemplate = next.map((label): ChecklistItemLike => {
    const existing = existingByKey.get(keyOf(label));
    return existing
      ? { id: existing.id, label: existing.label, checked: existing.checked }
      : { id: makeId(), label, checked: false };
  });
  const custom = current
    .filter((item) => !nextKeys.has(keyOf(item.label)) && !previousKeys.has(keyOf(item.label)))
    .map((item): ChecklistItemLike => ({ id: item.id, label: item.label, checked: item.checked }));
  return [...fromTemplate, ...custom];
}
