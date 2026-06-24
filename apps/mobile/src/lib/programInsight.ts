import { supabase } from "@/lib/supabase";

export type ProgramInsightInjury = { type: string; recoveryStatus: string | null; note: string | null };

export type ProgramInsightContext = {
  horseName: string;
  discipline: string | null;
  riderGoal: string | null;
  additionalInfo: string;
  injuries: ProgramInsightInjury[];
  safetyNotes: string[];
};

export class ProgramInsightError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Demande à Julien un éclairage sur le texte libre du cavalier/des blessures
 * — complément au moteur de règles déterministe (cf. apps/api/.../program-insight,
 * mobile/src/program/store.tsx). Ne lève jamais sur un texte sans intérêt : le
 * serveur renvoie `note: null` dans ce cas plutôt qu'une erreur. */
export async function askProgramInsight(context: ProgramInsightContext): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ProgramInsightError("Aucune session active.", 401);

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/program-insight`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(context),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ProgramInsightError(json?.error ?? "Erreur inconnue.", res.status);
  if (!json) throw new ProgramInsightError("Réponse invalide du serveur.", 502);
  return (json.note as string | null) ?? null;
}
