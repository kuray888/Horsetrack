import { NO_HEALTH_CONDITION } from "@/onboarding/options";

/** Bascule une condition de santé dans la liste, en gardant l'exclusion
 * mutuelle avec "Aucun problème connu" : cocher une vraie condition retire
 * "Aucun problème connu", et cocher "Aucun problème connu" efface toutes les
 * autres. Partagé par le formulaire cheval et l'écran Santé — une seule règle,
 * pas deux copies qui divergent. */
export function toggleHealthCondition(list: string[], value: string): string[] {
  if (value === NO_HEALTH_CONDITION) {
    return list.includes(NO_HEALTH_CONDITION) ? [] : [NO_HEALTH_CONDITION];
  }
  const withoutNone = list.filter((v) => v !== NO_HEALTH_CONDITION);
  return withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
}

/** Les vraies conditions de santé, sans la valeur sentinelle "Aucun problème connu". */
export function knownHealthConditions(list: string[]): string[] {
  return list.filter((c) => c !== NO_HEALTH_CONDITION);
}

/** listed = au moins une condition ; none = l'utilisateur a explicitement dit
 * "aucun problème connu" ; unknown = jamais renseigné (à distinguer : "rien
 * de connu" et "pas encore rempli" ne veulent pas dire la même chose). */
export function healthConditionsState(list: string[]): "listed" | "none" | "unknown" {
  if (knownHealthConditions(list).length > 0) return "listed";
  return list.includes(NO_HEALTH_CONDITION) ? "none" : "unknown";
}
