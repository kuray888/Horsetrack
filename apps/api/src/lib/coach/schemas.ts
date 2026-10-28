import { z } from "zod";
import * as z4 from "zod/v4";

/**
 * Formes échangées avec l'app (entrées des routes, zod) et avec le modèle
 * (sorties structurées, zod/v4 exigé par le SDK Anthropic).
 *
 * Les faits du cheval sont transmis tels quels au modèle : le serveur n'en
 * vérifie que la taille. Les contraintes et la liste d'exercices, elles,
 * sont vérifiées précisément : c'est contre elles que la réponse du coach
 * est revérifiée (cf. validate.ts).
 */

export const SESSION_TYPES = [
  "DRESSAGE_BASICS",
  "ASSOUPLISSEMENT",
  "BARRES_AU_SOL",
  "OBSTACLE",
  "SORTIE_EXTERIEURE",
  "TRAVAIL_A_PIED",
  "RENFORCEMENT",
  "RECUPERATION",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const INTENSITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Intensity = (typeof INTENSITIES)[number];

const PHASES = ["ECHAUFFEMENT", "CORPS_DE_SEANCE", "RETOUR_AU_CALME"] as const;

/** Objet JSON borné : les faits envoyés par l'app (12 Ko au plus). */
const boundedJson = (maxBytes: number) =>
  z
    .record(z.unknown())
    .refine((v) => JSON.stringify(v).length <= maxBytes, { message: "too_large" });

export const langSchema = z.enum(["fr", "en"]);

export const suggestionSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rest: z.boolean(),
  sessionType: z.enum(SESSION_TYPES).nullable(),
  exerciseIds: z.array(z.string().max(40)).max(8),
  durationMin: z.number().int().min(0).max(240),
  intensity: z.enum(INTENSITIES),
  reason: z.string().max(600),
  source: z.enum(["ai", "code"]),
});
export type CoachSuggestion = z.infer<typeof suggestionSchema>;

export const suggestionRequestSchema = z.object({
  horseId: z.string().min(1).max(64),
  lang: langSchema,
  facts: boundedJson(12_000),
  constraints: z.object({
    restRequired: z.boolean(),
    allowedTypes: z.array(z.enum(SESSION_TYPES)).max(SESSION_TYPES.length),
    maxIntensity: z.enum(INTENSITIES),
    minDurationMin: z.number().int().min(0).max(240),
    maxDurationMin: z.number().int().min(0).max(240),
    rules: z.array(z.string().max(300)).max(20),
  }),
  allowedExercises: z
    .array(
      z.object({
        id: z.string().max(40),
        type: z.enum(SESSION_TYPES),
        phase: z.enum(PHASES),
        title: z.string().max(200),
      })
    )
    .max(150),
  fallback: suggestionSchema,
});
export type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;

export const questionRequestSchema = z.object({
  lang: langSchema,
  question: z.string().trim().min(2).max(300),
  records: boundedJson(24_000),
});
export type QuestionRequest = z.infer<typeof questionRequestSchema>;

export const summaryRequestSchema = z.object({
  horseId: z.string().min(1).max(64),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  lang: langSchema,
  facts: boundedJson(6_000),
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

// --- Sorties du modèle ---------------------------------------------------------

export const SuggestionOutput = z4.object({
  rest: z4.boolean(),
  session_type: z4.enum([...SESSION_TYPES, "NONE"]),
  exercise_ids: z4.array(z4.string()),
  duration_min: z4.number().int(),
  intensity: z4.enum(INTENSITIES),
  reason: z4.string(),
});
export type SuggestionOutput = z4.infer<typeof SuggestionOutput>;

export const QuestionOutput = z4.object({
  answer: z4.string(),
  found: z4.boolean(),
  medical_concern: z4.boolean(),
});
export type QuestionOutput = z4.infer<typeof QuestionOutput>;

export const SummaryOutput = z4.object({
  summary: z4.string(),
  medical_concern: z4.boolean(),
});
export type SummaryOutput = z4.infer<typeof SummaryOutput>;
