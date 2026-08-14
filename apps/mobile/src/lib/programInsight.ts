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

export type ProgramInsightBonusExercise = { title: string; description: string };

export type ProgramInsightResult = {
  note: string | null;
  /** Exercice complémentaire ponctuel dérivé du texte libre, à insérer sur la
   * prochaine séance à venir (cf. program/store.tsx) — jamais un remplacement
   * de séance, toujours additif. `null` si le texte libre n'appelait aucun
   * exercice concret. */
  bonusExercise: ProgramInsightBonusExercise | null;
};

/** Demande à Julien un éclairage sur le texte libre du cavalier/des blessures
 * — complément au moteur de règles déterministe (cf. apps/api/.../program-insight,
 * mobile/src/program/store.tsx). Ne lève jamais sur un texte sans intérêt : le
 * serveur renvoie `note`/`bonusExercise` à `null` dans ce cas plutôt qu'une erreur. */
export async function askProgramInsight(context: ProgramInsightContext): Promise<ProgramInsightResult> {
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
  return { note: (json.note as string | null) ?? null, bonusExercise: (json.bonusExercise as ProgramInsightBonusExercise | null) ?? null };
}
