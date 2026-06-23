import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

const anthropic = new Anthropic();

/** Le Coach n'est pas derrière le paywall (cf. CoachChat.tsx) — cette limite
 * protège le budget API plutôt que la qualité de service. */
const DAILY_MESSAGE_LIMIT = 30;

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).max(20),
  context: z.object({
    horseName: z.string(),
    discipline: z.string().nullable(),
    horseLevel: z.string().nullable(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    riderLevel: z.string().nullable(),
    riderGoal: z.string().nullable(),
    additionalInfo: z.string(),
  }),
});

function buildSystemPrompt(ctx: z.infer<typeof schema>["context"]): string {
  const horseLine = [
    `Contexte — cheval : ${ctx.horseName}`,
    ctx.discipline ? `discipline ${ctx.discipline}` : null,
    ctx.horseLevel ? `niveau ${ctx.horseLevel}` : null,
    ctx.strengths.length ? `points forts : ${ctx.strengths.join(", ")}` : null,
    ctx.weaknesses.length ? `points faibles : ${ctx.weaknesses.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const lines = [
    "Tu es le Coach IA de l'application Cheval, qui aide cavaliers et chevaux à progresser ensemble.",
    "Réponds toujours en français, en 2 à 4 phrases, sur un ton chaleureux et concret — jamais de liste à puces, jamais de markdown.",
    "Reste strictement dans le domaine équestre (entraînement, santé, bien-être du cheval, préparation mentale du cavalier) ; recentre poliment si la question sort de ce cadre.",
    "Si la question porte sur une blessure ou un problème de santé précis, donne un conseil général puis rappelle qu'un vétérinaire doit confirmer le diagnostic — ne pose jamais de diagnostic toi-même.",
    "",
    `${horseLine}.`,
  ];

  if (ctx.riderLevel || ctx.riderGoal) {
    lines.push(`Contexte — cavalier : niveau ${ctx.riderLevel ?? "non précisé"}, objectif ${ctx.riderGoal ?? "non précisé"}.`);
  }
  if (ctx.additionalInfo.trim()) {
    lines.push(`Notes du cavalier à prendre en compte : ${ctx.additionalInfo.trim()}`);
  }

  return lines.join("\n");
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
  const { message, history, context } = parsed.data;

  const today = new Date().toISOString().slice(0, 10);
  const usage = await db.coachUsage.findUnique({ where: { userId_date: { userId, date: today } } });
  if (usage && usage.count >= DAILY_MESSAGE_LIMIT) {
    return NextResponse.json({ error: "Limite quotidienne de messages atteinte. Réessaie demain." }, { status: 429 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: buildSystemPrompt(context),
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.text })),
        { role: "user" as const, content: message },
      ],
    });

    await db.coachUsage.upsert({
      where: { userId_date: { userId, date: today } },
      update: { count: { increment: 1 } },
      create: { userId, date: today, count: 1 },
    });

    let reply: string;
    if (response.stop_reason === "refusal") {
      reply = "Désolé, je ne peux pas répondre à ça — pose-moi une question sur l'entraînement, la santé ou la progression de ton cheval.";
    } else {
      const textBlock = response.content.find((b) => b.type === "text");
      reply = textBlock && textBlock.type === "text" ? textBlock.text : "Désolé, je n'ai pas de réponse pour l'instant.";
    }

    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Le coach est surchargé, réessaie dans un instant." }, { status: 503 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "Le coach est indisponible pour l'instant." }, { status: 502 });
    }
    throw e;
  }
}
