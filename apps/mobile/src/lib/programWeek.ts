import { supabase } from "@/lib/supabase";
import type { Horse } from "@/horses/store";
import type { RiderProfile } from "@/rider/store";
import type { ExerciseStep, SessionIntensity, SessionTemplate, SessionType } from "@/program/types";
import { RIDER_GOALS, RIDER_LEVELS } from "@/onboarding/options";
import type { Mood } from "@/progress/store";

export type ProgramWeekHistoryEntry = {
  date: string;
  type: SessionType;
  intensity: SessionIntensity;
  completed: boolean;
  debriefMood: Mood | null;
};

export type ProgramWeekRequest = {
  horse: Horse;
  rider: RiderProfile;
  weekNumber: number;
  dayOffsets: number[];
  typeOccurrences: Record<string, number>;
  recentHistory: ProgramWeekHistoryEntry[];
};

export type ProgramWeekResponse = {
  weekNumber: number;
  sessions: (Omit<SessionTemplate, "time"> & { rationale: string })[];
  safetyNotes: string[];
  typeOccurrences: Record<string, number>;
  aiGenerated: boolean;
};

export class ProgramWeekError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Génère la semaine `weekNumber` du cursus continu de `horse` (cf.
 * /api/program-week) — l'IA choisit type/intensité par jour à partir de
 * l'historique réel, le serveur revérifie et remplit le contenu depuis la
 * bibliothèque vérifiée. Ne lève que sur un vrai problème réseau/auth : en
 * cas d'échec de l'appel IA côté serveur, la route renvoie quand même une
 * semaine exploitable (repli déterministe), jamais une erreur pour ce motif. */
export async function generateProgramWeek(req: ProgramWeekRequest): Promise<ProgramWeekResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ProgramWeekError("Aucune session active.", 401);

  const injuries = req.horse.injuries.map((i) => ({
    type: i.type,
    recoveryStatus: i.recoveryStatus,
    occurredAt: i.occurredAt ? i.occurredAt.toISOString() : null,
  }));

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/program-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      horse: {
        name: req.horse.name,
        discipline: req.horse.discipline,
        level: req.horse.level,
        heightCm: req.horse.heightCm,
        fitnessLevel: req.horse.fitnessLevel,
        workload: req.horse.workload,
        temperament: req.horse.temperament,
        strengths: req.horse.strengths,
        weaknesses: req.horse.weaknesses,
        healthConditions: req.horse.healthConditions,
        injuries,
      },
      rider: {
        level: req.rider.level ? RIDER_LEVELS.find((l) => l.value === req.rider.level)?.label ?? req.rider.level : null,
        goal: req.rider.primaryGoal ? RIDER_GOALS.find((g) => g.value === req.rider.primaryGoal)?.label ?? req.rider.primaryGoal : null,
        additionalInfo: req.rider.additionalInfo,
      },
      weekNumber: req.weekNumber,
      dayOffsets: req.dayOffsets,
      typeOccurrences: req.typeOccurrences,
      recentHistory: req.recentHistory,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ProgramWeekError(json?.error ?? "Erreur inconnue.", res.status);
  if (!json) throw new ProgramWeekError("Réponse invalide du serveur.", 502);
  return json as ProgramWeekResponse;
}

export type { ExerciseStep };
