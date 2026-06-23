import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db, SubscriptionStatus } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

const anthropic = new Anthropic();

/** Le Coach n'est pas derrière un mur total (cf. CoachChat.tsx) : les
 * non-abonnés y ont accès, avec un plafond plus bas — ces deux plafonds
 * protègent le budget API Anthropic plutôt que la qualité de service.
 * Tant que RevenueCat n'est pas configuré, `trialEndsAt` reste null pour
 * tout le monde et `isPremiumRider` renvoie donc true (essai ouvert) — le
 * plafond gratuit ne s'appliquera réellement qu'une fois le webhook
 * RevenueCat actif (cf. /api/revenuecat/webhook). */
const DAILY_MESSAGE_LIMIT_FREE = 5;
const DAILY_MESSAGE_LIMIT_PREMIUM = 20;

function isPremiumRider(rider: { subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null } | null): boolean {
  if (!rider) return false;
  if (rider.subscriptionStatus === SubscriptionStatus.ACTIVE) return true;
  if (rider.subscriptionStatus === SubscriptionStatus.TRIALING) {
    return !rider.trialEndsAt || rider.trialEndsAt.getTime() > Date.now();
  }
  return false;
}

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).max(20),
  context: z.object({
    horseName: z.string(),
    discipline: z.string().nullable(),
    horseLevel: z.string().nullable(),
    horseAge: z.number().nullable(),
    fitnessLevel: z.string().nullable(),
    workload: z.string().nullable(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    healthConditions: z.array(z.string()),
    injuries: z.array(
      z.object({
        type: z.string(),
        recoveryStatus: z.string().nullable(),
        note: z.string().nullable(),
      })
    ),
    riderLevel: z.string().nullable(),
    riderGoal: z.string().nullable(),
    additionalInfo: z.string(),
    todaySession: z
      .object({
        title: z.string(),
        focus: z.string(),
        intensity: z.string(),
        exercises: z.array(z.string()),
      })
      .nullable(),
    programSafetyNotes: z.array(z.string()),
  }),
});

function buildSystemPrompt(ctx: z.infer<typeof schema>["context"]): string {
  const horseLine = [
    `nom : ${ctx.horseName}`,
    ctx.discipline ? `discipline : ${ctx.discipline}` : null,
    ctx.horseLevel ? `niveau : ${ctx.horseLevel}` : null,
    ctx.horseAge !== null ? `âge : ${ctx.horseAge} ans` : null,
    ctx.fitnessLevel ? `forme actuelle : ${ctx.fitnessLevel}` : null,
    ctx.workload ? `charge de travail actuelle : ${ctx.workload}` : null,
    ctx.strengths.length ? `points forts : ${ctx.strengths.join(", ")}` : null,
    ctx.weaknesses.length ? `points faibles : ${ctx.weaknesses.join(", ")}` : null,
    ctx.healthConditions.length ? `conditions de santé connues : ${ctx.healthConditions.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" ; ");

  const injuryLines = ctx.injuries.map(
    (i) => `- ${i.type}${i.recoveryStatus ? ` (${i.recoveryStatus})` : ""}${i.note ? ` — ${i.note}` : ""}`
  );

  const lines = [
    "Tu es Julien, le coach IA de l'application Horsetrack. Tu raisonnes comme un coach équestre professionnel et expérimenté : tu t'appuies sur les principes d'équitation éthologique, de préparation physique progressive du cheval athlète et de bien-être animal — jamais sur des conseils génériques ou à la mode.",
    "",
    "Exigences de fond (priment sur tout le reste) :",
    "- Base-toi exclusivement sur le contexte ci-dessous et sur l'historique de la conversation. N'invente jamais une information absente (passé du cheval, résultats, matériel...) — si une donnée nécessaire manque pour répondre sérieusement, dis-le et pose une question précise plutôt que de supposer.",
    "- Si des restrictions de sécurité ont déjà été appliquées par le programme d'entraînement (cf. ci-dessous), respecte-les strictement et ne suggère jamais une activité qu'elles excluent.",
    "- Si une blessure est en cours de récupération ou laisse une séquelle à surveiller, intègre systématiquement cette prudence avant de proposer un exercice, même si la question ne porte pas directement sur la blessure.",
    "- Ne pose jamais de diagnostic vétérinaire toi-même : pour toute question de santé précise, donne un conseil général prudent puis renvoie vers un vétérinaire ou un ostéopathe équin pour confirmation.",
    "- Si la question sort du raisonnable au vu du contexte (ex: intensifier le travail d'un cheval au repos forcé), refuse poliment et explique pourquoi plutôt que de satisfaire la demande.",
    "",
    "Exigences de forme :",
    "- Réponds toujours en français, sur un ton professionnel, chaleureux et concret.",
    "- 2 à 4 phrases, jamais de liste à puces, jamais de markdown.",
    "- Reste strictement dans le domaine équestre (entraînement, santé, bien-être du cheval, préparation mentale du cavalier) ; recentre poliment si la question sort de ce cadre.",
    "",
    `Profil cheval — ${horseLine}.`,
  ];

  if (injuryLines.length) {
    lines.push("Antécédents de blessure à prendre en compte :", ...injuryLines);
  }

  if (ctx.riderLevel || ctx.riderGoal) {
    lines.push(
      `Profil cavalier — niveau : ${ctx.riderLevel ?? "non précisé"} ; objectif : ${ctx.riderGoal ?? "non précisé"}.`
    );
  }
  if (ctx.additionalInfo.trim()) {
    lines.push(`Notes du cavalier à prendre en compte : ${ctx.additionalInfo.trim()}`);
  }
  if (ctx.todaySession) {
    lines.push(
      `Séance prévue aujourd'hui : "${ctx.todaySession.title}" (focus : ${ctx.todaySession.focus}, intensité ${ctx.todaySession.intensity}) — exercices : ${ctx.todaySession.exercises.join(", ")}.`
    );
  }
  if (ctx.programSafetyNotes.length) {
    lines.push(`Restrictions déjà appliquées par le programme : ${ctx.programSafetyNotes.join(" ; ")}.`);
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

  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });
  const dailyLimit = isPremiumRider(riderProfile) ? DAILY_MESSAGE_LIMIT_PREMIUM : DAILY_MESSAGE_LIMIT_FREE;

  const today = new Date().toISOString().slice(0, 10);
  const usage = await db.coachUsage.findUnique({ where: { userId_date: { userId, date: today } } });
  if (usage && usage.count >= dailyLimit) {
    return NextResponse.json({ error: "Limite quotidienne de messages atteinte. Réessaie demain." }, { status: 429 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
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
