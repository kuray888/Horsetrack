import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { training } from "@cheval/shared";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { reserveDailyUsage } from "@/lib/usageLimit";
import { db, SubscriptionStatus, SubscriptionTier } from "@cheval/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

/**
 * Génère UNE semaine de programme, en s'appuyant sur l'historique réel du
 * cheval plutôt que sur un cycle fixe de 8 semaines qui se répète — cf.
 * mobile/src/program/store.tsx, qui appelle cette route chaque fois qu'une
 * nouvelle semaine doit être préparée.
 *
 * Répartition des responsabilités (le point important de cette route) :
 * - L'IA choisit le TYPE et l'INTENSITÉ de chaque séance de la semaine, en
 *   tenant compte de tout l'historique transmis (séances faites, ressenti) —
 *   c'est elle qui fait varier/progresser le cursus dans la durée.
 * - Elle ne choisit JAMAIS parmi les types exclus pour raison de santé/
 *   blessure : la liste qu'on lui donne dans le prompt est déjà filtrée (cf.
 *   computeSafetyRestrictions), et le serveur RE-VÉRIFIE et CORRIGE
 *   silencieusement après coup si jamais elle en proposait un quand même —
 *   jamais une simple consigne texte comme seule protection.
 * - Le contenu réel de chaque séance (exercices, matériel, hauteurs de saut,
 *   écartements de barres...) vient exclusivement de @cheval/shared/training
 *   (bibliothèque déjà vérifiée), jamais inventé par l'IA — un chiffre de
 *   sécurité halluciné serait un risque qu'aucun filtre en sortie ne peut
 *   rattraper de façon fiable.
 */

const injurySchema = z.object({
  type: z.string(),
  recoveryStatus: z.enum(["RECOVERED", "IN_PROGRESS", "ONGOING"]).nullable(),
  occurredAt: z.string().nullable(),
});

const SESSION_TYPES = [
  "DRESSAGE_BASICS",
  "ASSOUPLISSEMENT",
  "BARRES_AU_SOL",
  "OBSTACLE",
  "SORTIE_EXTERIEURE",
  "TRAVAIL_A_PIED",
  "RENFORCEMENT",
  "RECUPERATION",
] as const;

const historySessionSchema = z.object({
  date: z.string(),
  type: z.enum(SESSION_TYPES),
  intensity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  completed: z.boolean(),
  debriefMood: z.enum(["great", "good", "okay", "hard"]).nullable(),
});

const schema = z.object({
  horse: z.object({
    name: z.string(),
    discipline: z.enum(["SHOW_JUMPING", "DRESSAGE", "EVENTING", "WESTERN", "ENDURANCE", "LEISURE", "ETHOLOGY"]),
    level: z.enum(["UNTRAINED", "CLUB", "AMATEUR", "PRO"]),
    heightCm: z.number().nullable(),
    fitnessLevel: z.string().nullable(),
    workload: z.string().nullable(),
    temperament: z.array(z.string()),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    healthConditions: z.array(z.string()),
    injuries: z.array(injurySchema),
  }),
  rider: z.object({
    level: z.string().nullable(),
    goal: z.string().nullable(),
    additionalInfo: z.string(),
  }),
  weekNumber: z.number().int().min(1),
  dayOffsets: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  /** Combien de fois chaque type a déjà été programmé pour ce cheval, toute
   * son histoire confondue — sert uniquement à faire tourner les variantes
   * d'exercices (cf. @cheval/shared/training buildExercises), jamais lu par
   * l'IA. */
  typeOccurrences: z.record(z.string(), z.number()).default({}),
  /** Fenêtre récente (10-15 séances typiquement) — donne à l'IA de quoi
   * juger la progression réelle, pas besoin de tout l'historique. */
  recentHistory: z.array(historySessionSchema).max(20),
});

type Input = z.infer<typeof schema>;

function buildSystemPrompt(input: Input, restrictions: training.SafetyRestrictions, allowedTypes: string[]): string {
  const { horse, rider } = input;

  const injuryLines = horse.injuries
    .filter((i) => i.recoveryStatus === "IN_PROGRESS" || i.recoveryStatus === "ONGOING")
    .map((i) => `- ${i.type} (${i.recoveryStatus})`);

  const historyLines = input.recentHistory
    .slice(-15)
    .map((s) => `- ${s.date} : ${s.type}/${s.intensity}${s.completed ? "" : " (non faite)"}${s.debriefMood ? ` — ressenti "${s.debriefMood}"` : ""}`);

  const lines = [
    "Tu es Julien, le coach IA de l'application Horsetrack. Tu conçois la semaine d'entraînement de ce cheval en tenant compte de tout son historique réel — jamais une trame figée qui se répète, un vrai cursus qui progresse dans la durée.",
    "",
    `Cheval : ${horse.name}, discipline ${horse.discipline}, niveau ${horse.level}${horse.heightCm ? `, ${horse.heightCm} cm` : ""}.`,
    horse.fitnessLevel ? `Forme actuelle : ${horse.fitnessLevel}.` : null,
    horse.workload ? `Charge de travail actuelle : ${horse.workload}.` : null,
    horse.temperament.length ? `Tempérament : ${horse.temperament.join(", ")}.` : null,
    horse.strengths.length ? `Points forts : ${horse.strengths.join(", ")}.` : null,
    horse.weaknesses.length ? `Points faibles : ${horse.weaknesses.join(", ")}.` : null,
    rider.level ? `Niveau du cavalier : ${rider.level}.` : null,
    rider.goal ? `Objectif du cavalier : ${rider.goal}.` : null,
    rider.additionalInfo.trim() ? `Notes du cavalier : "${rider.additionalInfo.trim()}"` : null,
    "",
    "Restrictions de sécurité déjà calculées (santé/blessures) — OBLIGATOIRES, pas des suggestions :",
    restrictions.notes.length ? restrictions.notes.map((n) => `- ${n}`).join("\n") : "(aucune restriction particulière)",
    injuryLines.length ? "Blessures en cours à garder à l'esprit :" : null,
    ...injuryLines,
    "",
    `Types de séance autorisés pour ce cheval, et UNIQUEMENT ceux-là : ${allowedTypes.join(", ")}.`,
    `Intensité maximale autorisée cette semaine : ${restrictions.maxIntensity}.`,
    "",
    `C'est la semaine ${input.weekNumber} de ce cheval avec l'app. Historique récent (le plus ancien en premier) :`,
    historyLines.length ? historyLines.join("\n") : "(aucun historique — première semaine, reste prudent et progressif)",
    "",
    "Ton rôle : choisir, pour chacun des jours demandés, un type de séance (dans la liste autorisée) et une intensité (LOW/MEDIUM/HIGH, jamais au-dessus du maximum indiqué), en t'appuyant sur l'historique pour faire progresser le cheval de façon cohérente :",
    "- Si les dernières séances ont un ressenti \"hard\" répété, allège plutôt que d'intensifier.",
    "- Si le cheval enchaîne les séances réussies avec un bon ressenti, tu peux monter en exigence progressivement.",
    "- Ne répète jamais une structure de semaine identique à l'historique récent — varie les types et l'ordre.",
    "- Ne mets jamais deux séances de forte intensité consécutives (respecte une montée en charge progressive sur la semaine).",
    "",
    "Réponds STRICTEMENT en JSON, sans aucun texte avant/après, sous cette forme exacte :",
    `{"sessions": [{"dayOffset": <un des jours demandés>, "type": "<un type autorisé>", "intensity": "LOW|MEDIUM|HIGH", "rationale": "<1 phrase, en français, expliquant ce choix pour CE cheval précisément>"}]}`,
    `Jours demandés (fournis exactement un objet par jour, dans n'importe quel ordre) : ${input.dayOffsets.join(", ")}.`,
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}

const aiSessionSchema = z.object({
  dayOffset: z.number(),
  type: z.enum(SESSION_TYPES),
  intensity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  rationale: z.string(),
});
const aiResponseSchema = z.object({ sessions: z.array(aiSessionSchema) });

/** Extrait le JSON de la réponse du modèle — certains modèles entourent
 * quand même leur réponse de balises markdown ```json malgré la consigne. */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : content;
  return JSON.parse(raw.trim());
}

/** Repli 100% déterministe (pas d'appel IA) — utilisé si l'appel échoue ou
 * si la réponse est inexploitable, pour ne JAMAIS renvoyer d'erreur sèche à
 * l'utilisateur : une semaine simple et sûre vaut mieux que rien. */
function deterministicFallback(input: Input, allowedTypes: string[], maxIntensity: training.SessionIntensity) {
  const pool = allowedTypes.length > 0 ? allowedTypes : ["TRAVAIL_A_PIED", "RECUPERATION"];
  return input.dayOffsets.map((dayOffset, i) => ({
    dayOffset,
    type: pool[i % pool.length] as training.SessionType,
    intensity: maxIntensity,
    rationale: "Semaine par défaut (le coach IA était indisponible) — reste dans les repères habituels de ce cheval.",
  }));
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;

  // Cursus continu IA : réservé au palier Grand Prix, comme le Coach IA (cf.
  // grille tarifaire — "Programme d'entraînement personnalisé").
  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true },
  });
  const isGrandPrix =
    riderProfile?.subscriptionTier === SubscriptionTier.GRAND_PRIX &&
    (riderProfile.subscriptionStatus === SubscriptionStatus.ACTIVE ||
      (riderProfile.subscriptionStatus === SubscriptionStatus.TRIALING &&
        (!riderProfile.trialEndsAt || riderProfile.trialEndsAt.getTime() > Date.now())));
  if (!isGrandPrix) {
    return NextResponse.json({ error: "Le programme personnalisé est réservé au pack Grand Prix." }, { status: 403 });
  }

  // Restrictions de sécurité — calculées ICI, jamais déléguées à l'IA (cf.
  // @cheval/shared/training/safety.ts, seule source de vérité, partagée avec
  // le moteur de secours mobile).
  const restrictions = training.computeSafetyRestrictions({
    name: input.horse.name,
    heightCm: input.horse.heightCm,
    level: input.horse.level,
    healthConditions: input.horse.healthConditions,
    injuries: input.horse.injuries,
  });
  const allowedTypes = training.applyExclusions(training.DISCIPLINE_POOL[input.horse.discipline], restrictions);

  const reservation = await reserveDailyUsage(userId, "program_week", 10);
  if (!reservation.allowed) {
    return NextResponse.json({ error: "Limite quotidienne atteinte. Réessaie demain." }, { status: 429 });
  }

  let aiSessions: z.infer<typeof aiResponseSchema>["sessions"] | null = null;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: buildSystemPrompt(input, restrictions, allowedTypes),
      messages: [{ role: "user", content: "Génère la semaine." }],
    });

    const block = response.content[0];
    if (block?.type === "text" && block.text) {
      const json = extractJson(block.text);
      const validated = aiResponseSchema.safeParse(json);
      if (validated.success) aiSessions = validated.data.sessions;
    }
  } catch {
    // Best-effort : géré ci-dessous par le repli déterministe.
  }

  if (!aiSessions) await reservation.release();

  // Une session par jour demandé — si l'IA en a oublié/dupliqué, on complète
  // avec le repli déterministe plutôt que de renvoyer une semaine incomplète.
  const fallback = deterministicFallback(input, allowedTypes, restrictions.maxIntensity);
  const byDay = new Map(fallback.map((s) => [s.dayOffset, s]));
  if (aiSessions) {
    for (const s of aiSessions) {
      if (input.dayOffsets.includes(s.dayOffset)) byDay.set(s.dayOffset, s);
    }
  }

  // Re-vérification obligatoire : jamais confiance aveugle dans ce que l'IA a
  // respecté les instructions — un type hors de `allowedTypes` ou une
  // intensité au-dessus du maximum est corrigé silencieusement ici, pas
  // simplement redemandé/loggé.
  const allowedSet = new Set(allowedTypes);
  const intensityOrder: training.SessionIntensity[] = ["LOW", "MEDIUM", "HIGH"];
  const maxIdx = intensityOrder.indexOf(restrictions.maxIntensity);
  const typeOccurrences = { ...input.typeOccurrences };

  const sessions = input.dayOffsets
    .map((dayOffset) => byDay.get(dayOffset))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => {
      const safeType = allowedSet.has(s.type) ? s.type : (allowedTypes[0] as training.SessionType) ?? "RECUPERATION";
      const safeIntensity = intensityOrder.indexOf(s.intensity) > maxIdx ? restrictions.maxIntensity : s.intensity;

      const meta = training.SESSION_META[safeType];
      const durationMin = meta.baseDurationMin;
      const occurrence = typeOccurrences[safeType] ?? 0;
      typeOccurrences[safeType] = occurrence + 1;

      return {
        dayOffset: s.dayOffset,
        type: safeType,
        intensity: safeIntensity,
        title: meta.title,
        focus: meta.focus,
        durationMin,
        rationale: s.rationale,
        equipment: training.SESSION_EQUIPMENT[safeType],
        setupNotes: training.buildSetupNotes(safeType, input.horse, safeIntensity, durationMin),
        exercises: training.buildExercises(safeType, occurrence, durationMin),
      };
    });

  return NextResponse.json({
    weekNumber: input.weekNumber,
    sessions,
    safetyNotes: restrictions.notes,
    typeOccurrences,
    aiGenerated: aiSessions !== null,
  });
}
