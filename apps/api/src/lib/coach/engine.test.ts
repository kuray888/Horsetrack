import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { runQuestion, runSuggestion, type CoachClient } from "@/lib/coach/engine";
import { suggestionRequest } from "@/lib/coach/fixtures";
import { COACH_MODEL } from "@/lib/coach/config";

const usage = { input_tokens: 1200, output_tokens: 150, cache_read_input_tokens: 1100, cache_creation_input_tokens: 0 };

function fakeClient(response: object | Error): CoachClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  const parse = vi.fn(async (params: unknown) => {
    calls.push(params);
    if (response instanceof Error) throw response;
    return response;
  });
  return { messages: { parse } as unknown as CoachClient["messages"], calls };
}

describe("moteur du coach", () => {
  it("appelle Haiku 5.5, effort bas, prompt système en cache, sortie structurée", async () => {
    const client = fakeClient({
      stop_reason: "end_turn",
      usage,
      parsed_output: {
        rest: false,
        session_type: "DRESSAGE_BASICS",
        exercise_ids: ["DRESSAGE_BASICS.0.0", "DRESSAGE_BASICS.0.1", "DRESSAGE_BASICS.0.3"],
        duration_min: 40,
        intensity: "MEDIUM",
        reason: "Rien de fait au plat depuis 6 jours : une séance de bases pour la rectitude.",
      },
    });
    const r = await runSuggestion(client, suggestionRequest());
    expect(r.outcome).toBe("ok");
    expect(r.value.source).toBe("ai");
    expect(r.costUsd).toBeGreaterThan(0);
    const params = client.calls[0] as {
      model: string;
      output_config: { effort: string; format: unknown };
      system: { text: string; cache_control: unknown }[];
    };
    expect(params.model).toBe(COACH_MODEL);
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format).toBeDefined();
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    // Rien de variable dans le prompt système (sinon le cache ne sert jamais).
    expect(params.system[0].text).not.toMatch(/2026|Éclair/);
  });

  it("retombe sur la suggestion du code si la réponse sort des contraintes", async () => {
    const client = fakeClient({
      stop_reason: "end_turn",
      usage,
      parsed_output: {
        rest: false,
        session_type: "OBSTACLE",
        exercise_ids: ["OBSTACLE.0.0"],
        duration_min: 90,
        intensity: "HIGH",
        reason: "On saute !",
      },
    });
    const r = await runSuggestion(client, suggestionRequest());
    expect(r.outcome).toBe("fallback");
    expect(r.value.source).toBe("code");
    expect(r.errors).toContain("type_not_allowed");
  });

  it("retombe aussi sur un refus ou une erreur de l'API", async () => {
    expect((await runSuggestion(fakeClient({ stop_reason: "refusal", usage, parsed_output: null }), suggestionRequest())).outcome).toBe("refusal");
    const err = new Anthropic.APIError(529, undefined, "overloaded", new Headers());
    const r = await runSuggestion(fakeClient(err), suggestionRequest());
    expect(r.outcome).toBe("error");
    expect(r.value.source).toBe("code");
  });

  it("ne transmet jamais un symptôme au modèle", async () => {
    const client = fakeClient(new Error("ne doit pas être appelé"));
    const r = await runQuestion(client, { lang: "fr", question: "Il boite depuis hier, je fais quoi ?", records: {} });
    expect(r.outcome).toBe("medical");
    expect(r.value.answer).toContain("vétérinaire");
    expect(client.calls).toHaveLength(0);
  });

  it("remplace une réponse médicale par le renvoi vers le vétérinaire", async () => {
    const client = fakeClient({
      stop_reason: "end_turn",
      usage,
      parsed_output: { answer: "Donne-lui un anti-inflammatoire.", found: true, medical_concern: false },
    });
    const r = await runQuestion(client, { lang: "fr", question: "Que faire pour son dos ?", records: {} });
    expect(r.outcome).toBe("medical");
    expect(r.value.medical).toBe(true);
  });
});
