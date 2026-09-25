import { isSameDate } from "@/lib/dateFormat";

/**
 * « J'ai monté ce matin » saisi dans le formulaire alors que la séance était
 * déjà au planning : sans rien, ça fait deux lignes pour une seule sortie —
 * l'une cochée, l'autre restant éternellement « à faire » — et des statistiques
 * fausses (cf. computeSessionStats, qui compte les séances). On propose donc
 * de clore la séance existante plutôt que d'en créer une seconde.
 *
 * Module pur et sans dépendance react-native (même précaution que
 * horses/selectableHorses.ts) : testable sans passer par un rendu.
 */

/** Ce dont la règle a besoin d'une séance ; volontairement plus faible que
 * TrainingSession pour que le test n'ait pas à en fabriquer une complète. */
export type PlannedSession = {
  id: string;
  horseId: string | null;
  date: Date;
  completed: boolean;
};

/** Séance déjà planifiée que la saisie en cours ferait doublonner, ou `null`.
 *
 * Trois conditions, toutes nécessaires :
 * - la saisie décrit une séance DÉJÀ FAITE (`completed`) ; planifier deux
 *   séances le même jour est en revanche légitime (matin/soir) ;
 * - elle vise UN seul cheval — au-delà, « la » séance à clore n'existe pas ;
 * - il n'y a qu'UNE candidate ce jour-là pour ce cheval. Deux séances
 *   prévues le même jour, on ne devine pas laquelle : proposer la mauvaise
 *   coche une séance que l'utilisateur n'a pas faite, alors que ne rien
 *   proposer le laisse simplement utiliser « Marquer faite » sur la bonne
 *   carte (cf. SessionCard).
 *
 * Ne décide de rien : l'appelant propose, l'utilisateur choisit (cf.
 * planning.tsx). Une suggestion ne s'enregistre jamais toute seule.
 */
export function findPlannedSessionToComplete(
  sessions: PlannedSession[],
  targetHorseIds: string[],
  date: Date | null,
  markedAsDone: boolean
): PlannedSession | null {
  if (!markedAsDone || !date || targetHorseIds.length !== 1) return null;
  const horseId = targetHorseIds[0];
  const candidates = sessions.filter((s) => s.horseId === horseId && !s.completed && isSameDate(s.date, date));
  return candidates.length === 1 ? candidates[0] : null;
}
