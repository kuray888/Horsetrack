import { HEALTH_CONDITION_RULES, SESSION_META, type SessionIntensity, type SessionType } from "@/lib/sessionContent";
import {
  INTENSITY_ORDER,
  SESSION_TYPES,
  SESSION_TYPE_INFO,
  horseLevelAtLeast,
  intensityAtMost,
  libraryExercises,
  riderLevelAtLeast,
  type LibraryExercise,
} from "@/coach/exerciseLibrary";
import type { CoachFacts } from "@/coach/facts";
import type { Discipline, HorseLevel, RiderLevel } from "@/onboarding/store";
import { t } from "@/i18n";

/**
 * Contraintes de la prochaine séance — calculées par le code, jamais par
 * l'IA. Elles reprennent les règles déjà écrites dans l'app (conditions de
 * santé de lib/sessionContent.ts, blessures, niveaux) et y ajoutent la
 * charge de travail, les concours, les soins récents et la météo.
 *
 * Le serveur reçoit ces contraintes avec la liste des exercices autorisés,
 * et rejette toute réponse du coach qui en sort (cf.
 * apps/api/src/lib/coach/validate.ts). Logique pure, testée.
 */

export type CoachRule = { code: string; text: string };

export type CoachConstraints = {
  /** Aucune séance de travail ce jour-là : repos (ou pansage). */
  restRequired: boolean;
  allowedTypes: SessionType[];
  maxIntensity: SessionIntensity;
  minDurationMin: number;
  maxDurationMin: number;
  rules: CoachRule[];
};

export type AllowedExercise = Pick<LibraryExercise, "id" | "type" | "phase" | "title">;

const minIntensity = (a: SessionIntensity, b: SessionIntensity) =>
  INTENSITY_ORDER.indexOf(a) <= INTENSITY_ORDER.indexOf(b) ? a : b;

/** Codes météo Open-Meteo : neige, grésil, pluie verglaçante ; orages. */
const FREEZING_CODES = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);

export function buildConstraints(facts: CoachFacts): CoachConstraints {
  const rules: CoachRule[] = [];
  let allowed = new Set<SessionType>(SESSION_TYPES);
  // Modifié par `cap` : annoncé comme union, sinon TypeScript le croit figé à "HIGH".
  let maxIntensity = "HIGH" as SessionIntensity;
  let maxDuration = 60;
  let rest = false;
  const exclude = (types: SessionType[]) => types.forEach((ty) => allowed.delete(ty));
  const only = (types: SessionType[]) => {
    allowed = new Set([...allowed].filter((ty) => types.includes(ty)));
  };
  const cap = (i: SessionIntensity) => {
    maxIntensity = minIntensity(maxIntensity, i);
  };
  const capDuration = (m: number) => {
    maxDuration = Math.min(maxDuration, m);
  };
  const { horse, load, targetDay } = facts;
  const target = targetDay.inDays;

  // Niveaux du cheval et du cavalier.
  for (const ty of SESSION_TYPES) {
    const info = SESSION_TYPE_INFO[ty];
    if (!horseLevelAtLeast(horse.level as HorseLevel, info.minHorseLevel)) allowed.delete(ty);
    if (!riderLevelAtLeast(facts.rider.level as RiderLevel | null, info.minRiderLevel)) allowed.delete(ty);
  }
  if (facts.rider.level === null || facts.rider.level === "BEGINNER") {
    rules.push({ code: "rider_beginner", text: t("Cavalier débutant : pas de saut ni de travail en côte.") });
  }

  // Discipline : seulement les types de séance qui la concernent.
  const discipline = horse.discipline as Discipline;
  for (const ty of SESSION_TYPES) {
    const ds = SESSION_TYPE_INFO[ty].disciplines;
    if (ds.length > 0 && !ds.includes(discipline)) allowed.delete(ty);
  }

  // Conditions de santé déclarées (règles existantes de sessionContent.ts).
  for (const condition of horse.healthConditions) {
    const rule = HEALTH_CONDITION_RULES[condition];
    if (!rule) continue;
    exclude(rule.excludeTypes);
    if (rule.maxIntensity) cap(rule.maxIntensity);
    rules.push({ code: `health:${condition}`, text: rule.note.replace(/\*\*/g, "") });
  }

  // Blessure chronique : même prudence qu'une condition articulaire.
  if (horse.chronicInjuries.length > 0) {
    exclude(["OBSTACLE", "RENFORCEMENT"]);
    cap("MEDIUM");
    rules.push({ code: "injury_chronic", text: t("Blessure chronique : pas de saut ni de travail en côte, intensité modérée.") });
  }

  // Blessure en cours de récupération : rien de monté.
  if (horse.injuriesInRecovery.length > 0) {
    only(["RECUPERATION"]);
    cap("LOW");
    capDuration(25);
    rules.push({
      code: "injury_recovery",
      text: t("Blessure en cours de récupération : pas de travail monté, seulement de la marche en main, selon le protocole du vétérinaire."),
    });
  }

  // Forme du cheval.
  if (horse.fitness === "RESTING") {
    only(["RECUPERATION", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"]);
    cap("LOW");
    capDuration(30);
    rules.push({ code: "fitness_resting", text: t("Cheval au repos : reprise très douce, 30 min au plus.") });
  } else if (horse.fitness === "REOPENING") {
    exclude(["OBSTACLE", "RENFORCEMENT"]);
    cap("MEDIUM");
    capDuration(40);
    rules.push({ code: "fitness_reopening", text: t("Remise en forme : 40 min au plus, sans saut ni côte.") });
  }

  // Poney : séances un peu plus courtes.
  if (horse.pony) {
    capDuration(50);
    rules.push({ code: "pony", text: t("Poney : 50 min au plus.") });
  }

  // Concours.
  for (const c of facts.competitions) {
    const start = c.inDays;
    const end = c.inDays + c.days - 1;
    if (target >= start && target <= end) {
      rest = true;
      rules.push({ code: "competition_day", text: t("Jour de concours : pas de séance de travail en plus.") });
    } else if (target === start - 1) {
      only(["ASSOUPLISSEMENT", "DRESSAGE_BASICS", "SORTIE_EXTERIEURE", "TRAVAIL_A_PIED"]);
      cap("LOW");
      capDuration(40);
      rules.push({ code: "competition_eve", text: t("Veille de concours : séance légère de détente, 40 min au plus.") });
    } else if (target === end + 1) {
      only(["RECUPERATION", "SORTIE_EXTERIEURE", "TRAVAIL_A_PIED"]);
      cap("LOW");
      capDuration(40);
      rules.push({ code: "competition_after", text: t("Lendemain de concours : récupération, au pas.") });
    } else if (start - target >= 2 && start - target <= 3) {
      exclude(["RENFORCEMENT"]);
      cap("MEDIUM");
      rules.push({ code: "competition_soon", text: t("Concours dans 2 à 3 jours : pas de séance éprouvante.") });
    }
  }

  // Charge de travail.
  if (load.consecutiveWorkDays >= 6 || load.sessionsDone7d >= 6) {
    rest = true;
    rules.push({ code: "load_rest", text: t("6 jours de travail cette semaine : une journée de repos s'impose.") });
  } else if (load.hardSessions3d >= 2) {
    exclude(["OBSTACLE", "RENFORCEMENT"]);
    cap("MEDIUM");
    rules.push({ code: "load_hard", text: t("Deux séances intenses ces 3 derniers jours : séance plus légère.") });
  }

  // Soins récents.
  const recent = (type: string, days: number) => facts.health.recent.some((h) => h.type === type && h.daysAgo <= days);
  const onTarget = (type: string) => facts.health.upcoming.some((h) => h.type === type && h.inDays === target);
  if (recent("vaccination", 2) || onTarget("vaccination")) {
    cap("LOW");
    capDuration(30);
    rules.push({ code: "vaccine", text: t("Vaccin récent : 48 h de travail léger.") });
  }
  if (recent("osteo", 1) || onTarget("osteo")) {
    cap("LOW");
    capDuration(30);
    rules.push({ code: "osteo", text: t("Ostéopathe : journée légère le jour même et le lendemain.") });
  }

  // Météo du jour visé.
  const weather = facts.weather.find((w) => w.inDays === target);
  if (weather) {
    if (weather.minC <= -1 || FREEZING_CODES.has(weather.code)) {
      exclude(SESSION_TYPES.filter((ty) => SESSION_TYPE_INFO[ty].impact || SESSION_TYPE_INFO[ty].outdoor));
      rules.push({ code: "weather_frost", text: t("Gel ou neige annoncés : pas de saut, de barres ni de sortie sur sol dur.") });
    }
    if (STORM_CODES.has(weather.code)) {
      exclude(SESSION_TYPES.filter((ty) => SESSION_TYPE_INFO[ty].outdoor));
      rules.push({ code: "weather_storm", text: t("Orage annoncé : pas de sortie en extérieur.") });
    }
    if (weather.maxC >= 32) {
      cap("MEDIUM");
      capDuration(40);
      rules.push({ code: "weather_heat", text: t("Forte chaleur : 40 min au plus, aux heures fraîches.") });
    }
  }

  // Plafond « léger » : le saut et la côte ne se font pas légèrement. Les
  // autres types se pratiquent à l'intensité plafonnée.
  if (maxIntensity === "LOW") {
    for (const ty of [...allowed]) if (!intensityAtMost(SESSION_TYPE_INFO[ty].intensity, "MEDIUM")) allowed.delete(ty);
  }

  if (allowed.size === 0) {
    rest = true;
    rules.push({ code: "nothing_allowed", text: t("Aucune séance adaptée ce jour-là : repos ou pansage.") });
  }

  return {
    restRequired: rest,
    allowedTypes: rest ? [] : SESSION_TYPES.filter((ty) => allowed.has(ty)),
    maxIntensity,
    minDurationMin: Math.min(20, maxDuration),
    maxDurationMin: maxDuration,
    rules,
  };
}

/** Exercices que le coach a le droit de choisir : ceux des types autorisés. */
export function allowedExercises(constraints: CoachConstraints): AllowedExercise[] {
  if (constraints.restRequired) return [];
  return libraryExercises()
    .filter((e) => constraints.allowedTypes.includes(e.type))
    .map((e) => ({ id: e.id, type: e.type, phase: e.phase, title: e.title.replace(/\*\*/g, "") }));
}

/** Durée de base d'un type, ramenée dans les bornes. */
export function clampDuration(type: SessionType, c: CoachConstraints): number {
  return Math.max(c.minDurationMin, Math.min(c.maxDurationMin, SESSION_META[type].baseDurationMin));
}
