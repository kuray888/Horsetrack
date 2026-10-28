import type { ColumnState } from "@/lib/schemaGaps";

/**
 * Types de séance. Les 5 premiers existent depuis toujours dans l'enum
 * Postgres `activity_type` ; les suivants (travail à pied, cross, TREC…) ont
 * été ajoutés après coup.
 *
 * Plutôt que d'étendre l'enum — une ancienne version de l'app qui relirait
 * « TREC » planterait sur un type inconnu (cf. ACTIVITY_META) —, le serveur
 * garde dans `activityType` le type de base le plus proche, que toutes les
 * versions comprennent, et le type précis dans la colonne texte
 * `activityKind`. Une ancienne version affiche donc « Longe » pour un travail
 * à pied, jamais une erreur.
 */

export const LEGACY_ACTIVITIES = ["dressage", "cso", "balade", "longe", "repos"] as const;
export const EXTRA_ACTIVITIES = ["travail_a_pied", "liberte", "cross", "endurance", "trec", "pansage"] as const;

export type LegacyActivity = (typeof LEGACY_ACTIVITIES)[number];
export type ExtraActivity = (typeof EXTRA_ACTIVITIES)[number];
export type ActivityType = LegacyActivity | ExtraActivity;

const LEGACY_OF: Record<ExtraActivity, LegacyActivity> = {
  travail_a_pied: "longe",
  liberte: "longe",
  cross: "cso",
  endurance: "balade",
  trec: "balade",
  pansage: "repos",
};

/** Séances qui ne comptent pas comme du travail (statistiques, semaine). */
export function isRestActivity(type: ActivityType): boolean {
  return type === "repos" || type === "pansage";
}

export function isActivityType(value: unknown): value is ActivityType {
  return (
    typeof value === "string" &&
    ((LEGACY_ACTIVITIES as readonly string[]).includes(value) || (EXTRA_ACTIVITIES as readonly string[]).includes(value))
  );
}

/** Type de base, lisible par toutes les versions de l'app. */
export function legacyActivityOf(type: ActivityType): LegacyActivity {
  return (LEGACY_ACTIVITIES as readonly string[]).includes(type) ? (type as LegacyActivity) : LEGACY_OF[type as ExtraActivity];
}

/** Valeurs à écrire en base : enum de base (majuscules) + type précis. */
export function activityToServer(type: ActivityType): { activityType: string; activityKind: string | null } {
  const legacy = legacyActivityOf(type);
  return { activityType: legacy.toUpperCase(), activityKind: legacy === type ? null : type };
}

/**
 * Relecture : le type précis s'il est connu ET cohérent avec le type de base,
 * sinon le type de base. Une ancienne version de l'app n'écrit pas
 * `activityKind` : passer un « TREC » en « Dressage » depuis elle laisse
 * « trec » dans la colonne. Le type de base, lui, est toujours à jour.
 */
export function activityFromServer(activityType: string, activityKind?: string | null): ActivityType {
  const legacy = String(activityType ?? "").toLowerCase();
  if (isActivityType(activityKind) && legacyActivityOf(activityKind) === legacy) return activityKind;
  return isActivityType(legacy) ? legacy : "balade";
}

/**
 * Fusion du type relu du serveur quand la colonne `activityKind` manque (SQL
 * pas exécuté) ou vient d'être créée (cf. lib/schemaGaps.ts) : le serveur n'a
 * pas pu enregistrer le type précis. Tant qu'il a le même type de base, le
 * type précis local est gardé ; `resend` : la ligne doit repartir pour que le
 * serveur l'ait enfin. Hors de ces deux cas, le serveur fait foi.
 */
export function mergeActivityType(
  local: ActivityType,
  remote: ActivityType,
  state: ColumnState
): { type: ActivityType; resend: boolean } {
  const localIsPrecise = legacyActivityOf(local) !== local;
  if (state === "present" || !localIsPrecise || remote !== legacyActivityOf(local)) return { type: remote, resend: false };
  return { type: local, resend: state === "catching_up" };
}
