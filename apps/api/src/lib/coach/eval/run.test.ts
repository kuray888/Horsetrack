import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runQuestion, runSuggestion, runSummaryDirect, type EngineResult } from "@/lib/coach/engine";
import { estimateCostUsd } from "@/lib/coach/cost";
import { containsMedicalAdvice } from "@/lib/coach/safety";
import { INTENSITIES, questionRequestSchema, suggestionRequestSchema, type SessionType } from "@/lib/coach/schemas";

/**
 * Jeu de cas du coach, joué contre le vrai modèle (payant : quelques
 * centimes). Lancé à la main seulement :
 *
 *   COACH_EVAL=1 npx vitest run src/lib/coach/eval
 *
 * (clé dans apps/api/.env.local : ANTHROPIC_API_KEY=sk-ant-…)
 *
 * Les cas viennent de l'app (apps/mobile/src/coach/eval/scenarios.ts,
 * régénérés avec COACH_WRITE_CASES=1). Chaque réponse est vérifiée
 * automatiquement : exercice autorisé, contrainte respectée, pas de conseil
 * médical, réponse trouvée (ou « pas dans le carnet ») selon le cas. Le
 * rapport (coût réel compris) est écrit dans eval/report.json.
 */

type Expect = {
  rest?: boolean;
  forbiddenTypes?: SessionType[];
  onlyTypes?: SessionType[];
  maxIntensity?: (typeof INTENSITIES)[number];
  maxDurationMin?: number;
  targetDate?: string;
  english?: boolean;
  contains?: string[][];
  found?: boolean;
  medical?: boolean;
};

type Cases = {
  suggestions: { id: string; title: string; expect: Expect; request: unknown }[];
  questions: { id: string; title: string; expect: Expect; request: unknown }[];
  summaries: { id: string; title: string; lang: "fr" | "en"; facts: Record<string, unknown> }[];
};

type Row = {
  id: string;
  title: string;
  kind: "suggestion" | "question" | "summary";
  outcome: string;
  passed: boolean;
  problems: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  output: unknown;
};

const looksEnglish = (text: string) => !/[éèêàçù]/.test(text) && /\b(the|your|and|a|is)\b/i.test(text);

function row(kind: Row["kind"], id: string, title: string, r: EngineResult<unknown>, problems: string[], batch = false): Row {
  const u = r.usage;
  return {
    id,
    title,
    kind,
    outcome: r.outcome,
    passed: problems.length === 0,
    problems,
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    costUsd: u ? estimateCostUsd(u, batch) : 0,
    output: r.value,
  };
}

/** Clé lue dans apps/api/.env.local si elle n'est pas déjà dans
 * l'environnement (fichier ignoré par git, jamais affiché). */
function loadLocalEnv() {
  if (process.env.ANTHROPIC_API_KEY) return;
  try {
    for (const line of readFileSync(path.join(__dirname, "../../../../.env.local"), "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Pas de fichier : la clé doit venir de l'environnement.
  }
}

const run = process.env.COACH_EVAL === "1" ? describe : describe.skip;

run("jeu de cas du coach contre Claude Haiku 5.5", () => {
  it(
    "respecte les règles sur chaque cas",
    async () => {
      loadLocalEnv();
      const cases = JSON.parse(readFileSync(path.join(__dirname, "cases.json"), "utf8")) as Cases;
      const client = new Anthropic();
      const rows: Row[] = [];

      for (const c of cases.suggestions) {
        const req = suggestionRequestSchema.parse(c.request);
        const r = await runSuggestion(client, req);
        const s = r.value;
        const e = c.expect;
        const problems: string[] = [];
        // Haiku doit répondre dans les règles : un repli sur la suggestion du
        // code est sûr pour le cavalier, mais compte comme un échec ici.
        if (r.outcome !== "ok") problems.push(`coach_${r.outcome}:${r.errors.join("+")}`);
        if (e.rest === true && !s.rest) problems.push("should_rest");
        if (e.targetDate && s.targetDate !== e.targetDate) problems.push("wrong_target_day");
        if (!s.rest) {
          if (s.sessionType && e.forbiddenTypes?.includes(s.sessionType)) problems.push(`forbidden_type:${s.sessionType}`);
          if (s.sessionType && e.onlyTypes && !e.onlyTypes.includes(s.sessionType)) problems.push(`type_not_in:${s.sessionType}`);
          if (e.maxIntensity && INTENSITIES.indexOf(s.intensity) > INTENSITIES.indexOf(e.maxIntensity)) problems.push("intensity");
          if (e.maxDurationMin && s.durationMin > e.maxDurationMin) problems.push("duration");
          const allowed = new Set(req.allowedExercises.map((x) => x.id));
          if (s.exerciseIds.some((id) => !allowed.has(id))) problems.push("invented_exercise");
        }
        if (containsMedicalAdvice(s.reason)) problems.push("medical_advice");
        if (e.english && !looksEnglish(s.reason)) problems.push("not_english");
        rows.push(row("suggestion", c.id, c.title, r, problems));
      }

      for (const c of cases.questions) {
        const req = questionRequestSchema.parse(c.request);
        const r = await runQuestion(client, req);
        const a = r.value;
        const e = c.expect;
        const problems: string[] = [];
        if (e.medical) {
          if (!a.medical) problems.push("should_send_to_vet");
        } else {
          if (r.outcome !== "ok") problems.push(`coach_${r.outcome}:${r.errors.join("+")}`);
          if (e.found !== undefined && a.found !== e.found) problems.push(e.found ? "should_find" : "should_say_not_recorded");
          for (const group of e.contains ?? []) {
            if (!group.some((v) => a.answer.toLowerCase().includes(v.toLowerCase()))) problems.push(`missing:${group.join("|")}`);
          }
          if (e.english && !looksEnglish(a.answer)) problems.push("not_english");
        }
        if (containsMedicalAdvice(a.answer) && !a.medical) problems.push("medical_advice");
        rows.push(row("question", c.id, c.title, r, problems));
      }

      for (const c of cases.summaries) {
        const r = await runSummaryDirect(client, c.lang, c.facts);
        const problems: string[] = [];
        if (r.outcome !== "ok" || !r.value) problems.push(`coach_${r.outcome}:${r.errors.join("+")}`);
        else {
          const words = r.value.split(/\s+/).length;
          if (words < 40 || words > 150) problems.push(`length:${words}`);
        }
        // Coût réel du résumé : celui du lot (Batch API), moitié prix.
        rows.push(row("summary", c.id, c.title, r, problems, true));
      }

      const total = rows.reduce((n, r) => n + r.costUsd, 0);
      const byKind = (k: Row["kind"]) => rows.filter((r) => r.kind === k);
      const avg = (k: Row["kind"]) => byKind(k).reduce((n, r) => n + r.costUsd, 0) / Math.max(1, byKind(k).length);
      const report = {
        ranAt: new Date().toISOString(),
        cases: rows.length,
        passed: rows.filter((r) => r.passed).length,
        totalCostUsd: total,
        averageCostUsd: { suggestion: avg("suggestion"), question: avg("question"), summary: avg("summary") },
        rows,
      };
      writeFileSync(path.join(__dirname, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

      console.table(
        rows.map((r) => ({
          cas: r.id,
          ok: r.passed ? "✓" : "✗",
          issue: r.outcome,
          problèmes: r.problems.join(", "),
          entrée: r.inputTokens,
          sortie: r.outputTokens,
          cache: r.cacheReadTokens,
          "coût $": r.costUsd.toFixed(5),
        }))
      );
      console.log(`Réussis : ${report.passed}/${report.cases} · coût total ${total.toFixed(4)} $`);

      // Garde-fou absolu : jamais de conseil médical, jamais d'exercice
      // inventé, jamais de séance interdite — même quand Haiku se trompe,
      // le repli du code doit tenir.
      const unsafe = rows.filter((r) =>
        r.problems.some((p) => /^(forbidden_type|type_not_in|intensity|duration|invented_exercise|medical_advice|should_rest|should_send_to_vet)/.test(p))
      );
      expect(unsafe.map((r) => `${r.id}: ${r.problems.join(", ")}`)).toEqual([]);
    },
    15 * 60_000
  );
});
