import type { InjuryInput, SafetyHorseInput, SessionIntensity, SessionType } from "./types";

/**
 * Filtre de sécurité déterministe — la SEULE couche autorisée à décider quels
 * types de séance sont exclus et quelle intensité maximale est permise pour
 * un cheval donné. Utilisé des DEUX côtés :
 * - apps/api/.../program-week : filtre obligatoire appliqué à la proposition
 *   de l'IA AVANT qu'elle atteigne l'utilisateur — l'IA ne voit même que les
 *   types déjà autorisés, et le serveur re-vérifie/corrige quoi qu'il arrive
 *   plutôt que de faire confiance à ce que l'IA a respecté les instructions.
 * - apps/mobile/.../program/rules.ts : moteur de secours (déconnecté, échec
 *   de l'appel IA) — même filtre, mêmes seuils, une seule source de vérité.
 *
 * Première version volontairement transparente (pas de boîte noire), à
 * ajuster avec un vrai regard équestre/vétérinaire avant de la considérer
 * fiable à 100% : les seuils et la liste de gravité par type de blessure
 * ci-dessous sont des hypothèses de départ, pas une vérité médicale absolue —
 * mais ce sont des hypothèses appliquées par du code déterministe, jamais
 * livrées au jugement d'un modèle de langage.
 */

/** Une blessure déclarée "rétablie" il y a moins de ~8 semaines reste sous
 * surveillance légère (risque de récidive en phase de reprise). */
const RECENT_RECOVERY_WINDOW_DAYS = 56;

/** Restrictions spécifiques par condition de santé déclarée — seules les
 * conditions ayant un impact connu sur l'effort/l'impact articulaire ont une
 * règle ; les autres (allergies, coliques...) restent un point de vigilance
 * sans restriction d'exercice. */
export const HEALTH_CONDITION_RULES: Record<
  string,
  { excludeTypes: SessionType[]; maxIntensity?: SessionIntensity; note: string }
> = {
  Arthrose: {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "**Arthrose** signalée : travail de saut écarté, échauffement plus long recommandé.",
  },
  Fourbure: {
    excludeTypes: ["OBSTACLE", "BARRES_AU_SOL"],
    maxIntensity: "MEDIUM",
    note: "**Fourbure** signalée : travail à fort impact écarté, terrain souple à privilégier.",
  },
  "Tendinite chronique": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "**Tendinite** chronique signalée : travail de saut écarté par précaution.",
  },
  "Problème de dos": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "Problème de dos signalé : saut écarté ; pense à faire vérifier la selle et l'équilibre du cavalier.",
  },
  "Problème de pieds / sabots": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "Problème de pieds/sabots signalé : terrain dur à éviter, saut écarté par précaution.",
  },
  "Souffle / problème respiratoire": {
    excludeTypes: [],
    maxIntensity: "MEDIUM",
    note: "Problème respiratoire signalé : intensité plafonnée, surveille l'essoufflement à l'effort.",
  },
  "Problème de vue": {
    excludeTypes: ["OBSTACLE"],
    note: "Problème de vue signalé : terrain connu à privilégier, saut écarté par précaution.",
  },
};

/** Blessures sans lien avec l'aptitude au saut ou l'impact articulaire — une
 * colique ou une plaie superficielle ne justifient pas d'écarter le saut
 * comme le ferait une tendinite ou une fracture ; seule la prudence sur
 * l'intensité générale reste de mise. Tout type non répertorié ici (y
 * compris "Autre" en texte libre) reste traité par défaut comme à risque
 * articulaire/orthopédique, par prudence faute d'information. */
const NON_MUSCULOSKELETAL_INJURY_TYPES = new Set(["Colique", "Problème respiratoire", "Plaie / blessure superficielle"]);

const INTENSITY_ORDER: SessionIntensity[] = ["LOW", "MEDIUM", "HIGH"];

function capAt(current: SessionIntensity, max: SessionIntensity): SessionIntensity {
  return INTENSITY_ORDER.indexOf(current) > INTENSITY_ORDER.indexOf(max) ? max : current;
}

type InjuryCaution = "NONE" | "ACTIVE" | "MONITOR";

/** ACTIVE = récupération en cours (le plus prudent) ; MONITOR = séquelle
 * connue ou retour récent d'une blessure "rétablie" (< ~8 semaines) ; NONE =
 * rétablie depuis longtemps, aucune restriction. */
function injuryCautionLevel(injury: InjuryInput, now: number): InjuryCaution {
  if (injury.recoveryStatus === "IN_PROGRESS") return "ACTIVE";
  if (injury.recoveryStatus === "ONGOING") return "MONITOR";
  if (!injury.occurredAt) return "NONE";
  const daysSince = (now - new Date(injury.occurredAt).getTime()) / 86_400_000;
  return daysSince < RECENT_RECOVERY_WINDOW_DAYS ? "MONITOR" : "NONE";
}

function injuryNote(injury: InjuryInput, level: InjuryCaution, isMusculoskeletal: boolean): string {
  if (!isMusculoskeletal) {
    return level === "ACTIVE"
      ? `${injury.type} en cours de récupération : travail très progressif en attendant la guérison complète.`
      : `${injury.type} à surveiller (séquelle ou retour récent) : intensité modérée par précaution.`;
  }
  if (level === "ACTIVE") {
    return `${injury.type} en cours de récupération : travail très progressif, saut et barres au sol écartés tant que la récupération n'est pas terminée.`;
  }
  return `${injury.type} à surveiller (séquelle ou retour récent) : travail de saut écarté par précaution.`;
}

export type SafetyRestrictions = {
  /** Types de séance à ne jamais proposer pour ce cheval, quoi qu'il arrive. */
  excludedTypes: Set<SessionType>;
  /** Intensité maximale autorisée, toutes séances confondues. */
  maxIntensity: SessionIntensity;
  /** Explications affichées au cavalier (pourquoi ces restrictions). */
  notes: string[];
};

/**
 * Calcule les restrictions de sécurité pour un cheval donné, à partir de ses
 * conditions de santé déclarées et de son historique de blessures. Fonction
 * pure, déterministe, sans dépendance réseau/IA — c'est le point d'entrée
 * unique que tout appelant (route IA ou moteur de secours) doit utiliser.
 */
export function computeSafetyRestrictions(horse: SafetyHorseInput, now: number = Date.now()): SafetyRestrictions {
  const excludedTypes = new Set<SessionType>();
  let maxIntensity: SessionIntensity = "HIGH";
  const notes: string[] = [];

  for (const condition of horse.healthConditions) {
    const rule = HEALTH_CONDITION_RULES[condition];
    if (!rule) continue;
    for (const t of rule.excludeTypes) excludedTypes.add(t);
    if (rule.maxIntensity) maxIntensity = capAt(maxIntensity, rule.maxIntensity);
    notes.push(rule.note);
  }

  for (const injury of horse.injuries) {
    const level = injuryCautionLevel(injury, now);
    if (level === "NONE") continue;
    const isMusculoskeletal = !NON_MUSCULOSKELETAL_INJURY_TYPES.has(injury.type);
    if (isMusculoskeletal) {
      excludedTypes.add("OBSTACLE");
      if (level === "ACTIVE") excludedTypes.add("BARRES_AU_SOL");
    }
    maxIntensity = capAt(maxIntensity, level === "ACTIVE" ? "LOW" : "MEDIUM");
    notes.push(injuryNote(injury, level, isMusculoskeletal));
  }

  return { excludedTypes, maxIntensity, notes };
}

/** Pool de types restants une fois les exclusions appliquées à une pool de
 * départ — si tout est exclu, retombe sur du travail à pied/récupération
 * plutôt que de laisser une pool vide (aucun cheval, quelle que soit sa
 * situation, ne doit se retrouver sans aucune activité possible). */
export function applyExclusions(pool: SessionType[], restrictions: SafetyRestrictions): SessionType[] {
  const filtered = pool.filter((t) => !restrictions.excludedTypes.has(t));
  return filtered.length > 0 ? filtered : (["TRAVAIL_A_PIED", "RECUPERATION"] as SessionType[]);
}
