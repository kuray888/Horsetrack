import { NEVER_RECURRENCE, type Recurrence } from "@/lib/recurrence";
import { OTHER_OPTION } from "@/onboarding/options";
import type { ActivityType } from "@/agenda/store";
import type { SessionIntensity, TrainingSession } from "@/sessions/store";

/** État du formulaire de séance du Planning — sorti de
 * app/(tabs)/planning.tsx tel quel. */

export const DURATION_OPTIONS = [30, 45, 60, 90];

/** Sélection affichée par le sélecteur "Type de séance" — `activityType`
 * (5 valeurs existantes) + la sentinelle `OTHER_OPTION` (même convention que
 * BreedField/CoatField/InjuryHistoryField/goal-modal.tsx pour "Autre /
 * saisie libre"). Décorrélée de `activityType` lui-même : ce dernier garde
 * toujours une valeur technique valide (jamais "Autre"), nécessaire tant que
 * l'enum existant n'est pas étendu — cf. son commentaire sur TrainingSession. */
export type SessionTypeSelection = ActivityType | typeof OTHER_OPTION;

export type SessionForm = {
  activityType: ActivityType;
  typeSelection: SessionTypeSelection;
  customActivityLabel: string;
  date: Date | null;
  time: string;
  durationMinutes: number;
  intensity: SessionIntensity;
  notes: string;
  recurrence: Recurrence;
  /** Chevaux visés à la création — vide = « aucun choix explicite », donc la
   * cible par défaut de la vue (cf. defaultHorseIds : aucun en vue « Tous »,
   * sinon le cheval ciblé). Ignoré en édition, comme pour les rendez-vous. */
  horseIds: string[];
  /** « Planifier » (faux, défaut) ou « Enregistrer une séance faite » (vrai).
   * Les deux gestes produisent la même TrainingSession — seul `completed`
   * change (cf. addSession) —, mais ce ne sont pas la même intention : noter
   * après coup la séance du matin obligeait sinon à créer la séance puis à
   * la cocher, et rien dans le formulaire ne disait laquelle des deux choses
   * on était en train de faire. Ignoré en édition : la carte de la séance
   * garde son propre « Marquer faite » (cf. SessionCard). */
  completed: boolean;
};

export function emptyForm(): SessionForm {
  return {
    activityType: "dressage",
    typeSelection: "dressage",
    customActivityLabel: "",
    date: new Date(),
    time: "",
    durationMinutes: 45,
    intensity: "medium",
    notes: "",
    recurrence: NEVER_RECURRENCE,
    horseIds: [],
    completed: false,
  };
}

export function formFromSession(session: TrainingSession): SessionForm {
  return {
    activityType: session.activityType,
    typeSelection: session.customActivityLabel ? OTHER_OPTION : session.activityType,
    customActivityLabel: session.customActivityLabel ?? "",
    date: session.date,
    time: session.time,
    durationMinutes: session.durationMinutes ?? 45,
    intensity: session.intensity ?? "medium",
    notes: session.notes,
    recurrence: NEVER_RECURRENCE,
    horseIds: [],
    completed: session.completed,
  };
}
