import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { COACH_MODEL, MAX_TOKENS } from "@/lib/coach/config";
import { estimateCostUsd, type CoachUsage } from "@/lib/coach/cost";
import { COACH_SYSTEM_PROMPT, userMessage } from "@/lib/coach/prompts";
import { mentionsSymptom, vetMessage } from "@/lib/coach/safety";
import {
  QuestionOutput,
  SuggestionOutput,
  SummaryOutput,
  type CoachSuggestion,
  type QuestionRequest,
  type SuggestionRequest,
} from "@/lib/coach/schemas";
import { checkAnswer, checkSuggestion, checkSummary } from "@/lib/coach/validate";

/**
 * Appels au modèle — sans base ni HTTP, pour être testés avec un faux client
 * (engine.test.ts) et rejoués par le jeu de cas de test (eval).
 *
 * Chaque appel : prompt système en cache, faits en JSON compact, sortie
 * structurée (schéma strict), effort bas. Toute réponse est revérifiée
 * (validate.ts) ; en cas d'écart, de refus ou d'erreur, la suggestion
 * calculée par le code est renvoyée à la place.
 */

/** Ce dont le moteur a besoin du SDK (un faux client suffit en test). */
export type CoachClient = { messages: Pick<Anthropic["messages"], "parse"> };

/** ok : réponse du coach acceptée ; fallback : réponse refusée, repli du
 * code ; medical : renvoi vers le vétérinaire ; refusal / error : le modèle a
 * refusé ou l'appel a échoué (repli). */
export type Outcome = "ok" | "fallback" | "medical" | "refusal" | "error";

export type EngineResult<T> = {
  value: T;
  outcome: Outcome;
  usage: CoachUsage | null;
  costUsd: number;
  errors: string[];
};

const SYSTEM = [{ type: "text" as const, text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } }];

function errorCode(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `api_${e.status ?? "unknown"}`;
  if (e instanceof Error) return e.name;
  return "unknown";
}

async function callModel<S extends Parameters<typeof zodOutputFormat>[0]>(
  client: CoachClient,
  schema: S,
  maxTokens: number,
  content: string
) {
  const response = await client.messages.parse({
    model: COACH_MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(schema) },
  });
  return {
    parsed: response.stop_reason === "refusal" ? null : response.parsed_output,
    refused: response.stop_reason === "refusal",
    usage: response.usage as CoachUsage,
  };
}

// --- « Ta prochaine séance » -------------------------------------------------

export async function runSuggestion(client: CoachClient, req: SuggestionRequest): Promise<EngineResult<CoachSuggestion>> {
  const fallback: CoachSuggestion = { ...req.fallback, source: "code" };
  try {
    const { parsed, refused, usage } = await callModel(
      client,
      SuggestionOutput,
      MAX_TOKENS.suggestion,
      userMessage("suggestion", req.lang, {
        facts: req.facts,
        constraints: req.constraints,
        // Le type est déjà dans l'identifiant (« TYPE.variante.étape ») : un
        // champ de moins par exercice, la liste est la plus grosse partie du
        // message. Le serveur garde la liste complète pour revérifier.
        allowedExercises: req.allowedExercises.map(({ id, phase, title }) => ({ id, phase, title })),
      })
    );
    const costUsd = estimateCostUsd(usage);
    if (refused) return { value: fallback, outcome: "refusal", usage, costUsd, errors: ["refusal"] };
    if (!parsed) return { value: fallback, outcome: "fallback", usage, costUsd, errors: ["unparsable"] };
    const checked = checkSuggestion(parsed, req);
    return checked.ok
      ? { value: checked.value, outcome: "ok", usage, costUsd, errors: [] }
      : { value: fallback, outcome: "fallback", usage, costUsd, errors: checked.errors };
  } catch (e) {
    return { value: fallback, outcome: "error", usage: null, costUsd: 0, errors: [errorCode(e)] };
  }
}

// --- « Pose une question sur ton cheval » -----------------------------------

export type Answer = { answer: string; found: boolean; medical: boolean };

export async function runQuestion(client: CoachClient, req: QuestionRequest): Promise<EngineResult<Answer>> {
  const vet: Answer = { answer: vetMessage(req.lang), found: false, medical: true };
  // Symptôme ou demande de soin : jamais transmis au modèle.
  if (mentionsSymptom(req.question)) return { value: vet, outcome: "medical", usage: null, costUsd: 0, errors: [] };

  const unavailable: Answer = {
    answer:
      req.lang === "en"
        ? "I can't answer right now. Please try again in a moment."
        : "Je ne peux pas répondre pour le moment. Réessaie dans un instant.",
    found: false,
    medical: false,
  };
  try {
    const { parsed, refused, usage } = await callModel(
      client,
      QuestionOutput,
      MAX_TOKENS.question,
      userMessage("question", req.lang, { question: req.question, records: req.records })
    );
    const costUsd = estimateCostUsd(usage);
    if (refused) return { value: unavailable, outcome: "refusal", usage, costUsd, errors: ["refusal"] };
    if (!parsed) return { value: unavailable, outcome: "fallback", usage, costUsd, errors: ["unparsable"] };
    if (parsed.medical_concern) return { value: vet, outcome: "medical", usage, costUsd, errors: [] };
    const checked = checkAnswer(parsed);
    if (!checked.ok) {
      const medical = checked.errors.includes("medical_advice");
      return { value: medical ? vet : unavailable, outcome: medical ? "medical" : "fallback", usage, costUsd, errors: checked.errors };
    }
    return { value: { ...checked.value, medical: false }, outcome: "ok", usage, costUsd, errors: [] };
  } catch (e) {
    return { value: unavailable, outcome: "error", usage: null, costUsd: 0, errors: [errorCode(e)] };
  }
}

// --- Résumé du mois (Batch API) ---------------------------------------------

/** Une requête du lot mensuel. Même prompt système (cache), même format. */
export function summaryBatchRequest(customId: string, lang: "fr" | "en", facts: Record<string, unknown>) {
  return {
    custom_id: customId,
    params: {
      model: COACH_MODEL,
      max_tokens: MAX_TOKENS.summary,
      system: SYSTEM,
      messages: [{ role: "user" as const, content: userMessage("summary", lang, { facts }) }],
      output_config: { effort: "low" as const, format: zodOutputFormat(SummaryOutput) },
    },
  };
}

/** Lecture d'un résultat du lot : le texte JSON du message, revérifié. */
export function readSummaryResult(message: { content: { type: string; text?: string }[]; stop_reason: string | null }) {
  if (message.stop_reason === "refusal") return { ok: false as const, errors: ["refusal"] };
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) return { ok: false as const, errors: ["empty"] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false as const, errors: ["unparsable"] };
  }
  const parsed = SummaryOutput.safeParse(json);
  if (!parsed.success) return { ok: false as const, errors: ["schema"] };
  return checkSummary(parsed.data);
}

/** Résumé en direct (jeu de cas de test : même requête que le lot). */
export async function runSummaryDirect(client: CoachClient, lang: "fr" | "en", facts: Record<string, unknown>): Promise<EngineResult<string | null>> {
  try {
    const { parsed, refused, usage } = await callModel(client, SummaryOutput, MAX_TOKENS.summary, userMessage("summary", lang, { facts }));
    const costUsd = estimateCostUsd(usage);
    if (refused || !parsed) return { value: null, outcome: refused ? "refusal" : "fallback", usage, costUsd, errors: [refused ? "refusal" : "unparsable"] };
    const checked = checkSummary(parsed);
    return checked.ok
      ? { value: checked.value, outcome: "ok", usage, costUsd, errors: [] }
      : { value: null, outcome: "fallback", usage, costUsd, errors: checked.errors };
  } catch (e) {
    return { value: null, outcome: "error", usage: null, costUsd: 0, errors: [errorCode(e)] };
  }
}
