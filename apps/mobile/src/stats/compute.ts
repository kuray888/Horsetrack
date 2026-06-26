import type { PlannedSession } from "@/program/store";
import type { JournalEntry } from "@/agenda/store";
import { sessionLoad } from "@/program/rules";
import type { SessionType } from "@/program/types";

/**
 * Statistiques avancées — calculées côté client à partir des vraies données
 * (séances de programme cochées + entrées de journal libre), pas des
 * placeholders. Pas de bibliothèque de graphiques : les écrans affichent ces
 * chiffres avec de simples barres (View + largeur en %), cf. components/
 * DisciplineBreakdownCard.tsx.
 */

export type DisciplineBucket = "Dressage" | "Obstacle" | "Balade" | "Travail à pied" | "Renforcement" | "Repos";

/** Regroupe les taxonomies internes (SessionType du programme, ActivityType
 * du journal libre) dans des catégories reconnaissables par un cavalier —
 * les deux sources d'activité réelle sont fusionnées dans la même échelle. */
const SESSION_TYPE_BUCKET: Record<SessionType, DisciplineBucket> = {
  DRESSAGE_BASICS: "Dressage",
  ASSOUPLISSEMENT: "Dressage",
  BARRES_AU_SOL: "Obstacle",
  OBSTACLE: "Obstacle",
  SORTIE_EXTERIEURE: "Balade",
  TRAVAIL_A_PIED: "Travail à pied",
  RENFORCEMENT: "Renforcement",
  RECUPERATION: "Repos",
};

const ACTIVITY_TYPE_BUCKET: Record<JournalEntry["activityType"], DisciplineBucket> = {
  dressage: "Dressage",
  cso: "Obstacle",
  balade: "Balade",
  longe: "Travail à pied",
  repos: "Repos",
};

export type DisciplineStat = { bucket: DisciplineBucket; count: number; pct: number };

/** Répartition par discipline — séances de programme réellement faites
 * (`doneSessions`, déjà filtrées par l'appelant via progress/store.tsx
 * `isDone`) + entrées de journal libre, fusionnées. Tableau vide si aucune
 * activité enregistrée, trié du plus fréquent au moins fréquent. */
export function disciplineBreakdown(doneSessions: PlannedSession[], journalEntries: JournalEntry[]): DisciplineStat[] {
  const counts = new Map<DisciplineBucket, number>();
  const bump = (bucket: DisciplineBucket) => counts.set(bucket, (counts.get(bucket) ?? 0) + 1);

  for (const s of doneSessions) bump(SESSION_TYPE_BUCKET[s.type]);
  for (const j of journalEntries) bump(ACTIVITY_TYPE_BUCKET[j.activityType]);

  const total = doneSessions.length + journalEntries.length;
  if (total === 0) return [];

  return Array.from(counts.entries())
    .map(([bucket, count]) => ({ bucket, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export type WorkloadLevel = "LEGERE" | "MODEREE" | "ELEVEE" | "TRES_ELEVEE";
export type WorkloadResult = { points: number; level: WorkloadLevel; label: string };

const INTENSITY_FACTOR: Record<PlannedSession["intensity"], number> = { LOW: 1, MEDIUM: 1.5, HIGH: 2 };

/**
 * Score de charge réel sur les `windowDays` derniers jours — somme, pour
 * chaque séance de programme effectivement faite, de (poids-discipline ×
 * facteur d'intensité × durée/30 min). Repose sur le programme (durée +
 * intensité connues) ; le journal libre n'a pas de durée renseignée, pas
 * assez d'info pour entrer dans le même calcul — uniquement utilisé pour la
 * répartition par discipline ci-dessus, pas pour la charge.
 *
 * Pas une formule médicale : seuils empiriques (mêmes hypothèses de départ
 * que le reste du moteur de règles, cf. program/rules.ts), à ajuster avec un
 * vrai regard équestre/vétérinaire. Remplace l'ancien indicateur "Précision"
 * qui affichait un chiffre fictif sans rien derrière.
 */
export function workloadScore(doneSessions: PlannedSession[], windowDays: number, now = new Date()): WorkloadResult {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);

  let points = 0;
  for (const s of doneSessions) {
    if (s.date < windowStart || s.date > now) continue;
    const load = sessionLoad(s.type);
    if (load === 0) continue;
    points += load * INTENSITY_FACTOR[s.intensity] * (s.durationMin / 30);
  }
  points = Math.round(points);

  // Seuils calibrés pour une fenêtre de 7 jours, ramenés au prorata pour une
  // fenêtre différente.
  const weeklyEquivalent = points * (7 / windowDays);
  let level: WorkloadLevel;
  let label: string;
  if (weeklyEquivalent < 8) {
    level = "LEGERE";
    label = "Charge légère";
  } else if (weeklyEquivalent < 18) {
    level = "MODEREE";
    label = "Charge modérée";
  } else if (weeklyEquivalent < 28) {
    level = "ELEVEE";
    label = "Charge élevée";
  } else {
    level = "TRES_ELEVEE";
    label = "Charge très élevée — pense à ménager des temps de récupération";
  }

  return { points, level, label };
}
