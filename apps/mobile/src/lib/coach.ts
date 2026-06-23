import { supabase } from "@/lib/supabase";

export type CoachHistoryEntry = { role: "user" | "assistant"; text: string };

export type CoachInjury = { type: string; recoveryStatus: string | null; note: string | null };

export type CoachSession = { title: string; focus: string; intensity: string; exercises: string[] };

export type CoachContext = {
  horseName: string;
  discipline: string | null;
  horseLevel: string | null;
  horseAge: number | null;
  fitnessLevel: string | null;
  workload: string | null;
  strengths: string[];
  weaknesses: string[];
  healthConditions: string[];
  injuries: CoachInjury[];
  riderLevel: string | null;
  riderGoal: string | null;
  additionalInfo: string;
  todaySession: CoachSession | null;
  programSafetyNotes: string[];
};

export class CoachError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function askCoach(
  message: string,
  history: CoachHistoryEntry[],
  context: CoachContext
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CoachError("Aucune session active.", 401);

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, history, context }),
  });

  const json = await res.json();
  if (!res.ok) throw new CoachError(json.error ?? "Erreur inconnue.", res.status);
  return json.reply as string;
}
