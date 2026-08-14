import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { isGrandPrixRider } from "@/lib/subscription";
import { reserveDailyUsage } from "@/lib/usageLimit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

/** Le Coach IA est réservé au palier Grand Prix (cf. grille tarifaire) — Free
 * et Paddock n'y ont pas accès du tout. Le plafond quotidien ci-dessous ne
 * protège plus une "version gratuite dégradée" : il protège le budget de
 * l'API LLM même pour les abonnés Grand Prix ("illimité" côté marketing,
 * réellement capé côté serveur).
 * Tant que RevenueCat n'est pas configuré, `subscriptionTier` reste à sa
 * valeur par défaut généreuse (GRAND_PRIX, cf. schema.prisma) pour tout le
 * monde — l'accès Coach IA ne sera réellement restreint qu'une fois le
 * webhook RevenueCat actif (cf. /api/revenuecat/webhook). */
const DAILY_MESSAGE_LIMIT_GRAND_PRIX = 20;

// `context` est reconstruit et re-tokenisé à CHAQUE message (pas juste une
// fois) — sans bornes, son coût en tokens n'est plafonné par rien d'autre que
// le nombre de messages/jour, pas leur taille. Ces limites suivent ce que
// l'app envoie réellement (labels courts issus de listes fixes, notes libres
// d'un paragraphe) plutôt que d'être arbitraires.
const MAX_SHORT_TEXT = 100;
const MAX_NOTE_TEXT = 500;
const MAX_LIST_LENGTH = 20;

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(20),
  context: z.object({
    horseName: z.string().max(MAX_SHORT_TEXT),
    discipline: z.string().max(MAX_SHORT_TEXT).nullable(),
    horseLevel: z.string().max(MAX_SHORT_TEXT).nullable(),
    horseAge: z.number().nullable(),
    fitnessLevel: z.string().max(MAX_SHORT_TEXT).nullable(),
    workload: z.string().max(MAX_SHORT_TEXT).nullable(),
    strengths: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_LIST_LENGTH),
    weaknesses: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_LIST_LENGTH),
    healthConditions: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_LIST_LENGTH),
    injuries: z
      .array(
        z.object({
          type: z.string().max(MAX_SHORT_TEXT),
          recoveryStatus: z.string().max(MAX_SHORT_TEXT).nullable(),
          note: z.string().max(MAX_NOTE_TEXT).nullable(),
        })
      )
      .max(MAX_LIST_LENGTH),
    riderLevel: z.string().max(MAX_SHORT_TEXT).nullable(),
    riderGoal: z.string().max(MAX_SHORT_TEXT).nullable(),
    additionalInfo: z.string().max(MAX_NOTE_TEXT),
    todaySession: z
      .object({
        title: z.string().max(MAX_SHORT_TEXT),
        focus: z.string().max(MAX_SHORT_TEXT),
        intensity: z.string().max(MAX_SHORT_TEXT),
        exercises: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_LIST_LENGTH),
      })
      .nullable(),
    programSafetyNotes: z.array(z.string().max(MAX_NOTE_TEXT)).max(MAX_LIST_LENGTH),
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
    "Tu es Julien, le coach IA de l'application Horsetrack — un coach équestre senior, niveau instructeur confirmé, formé et expérimenté dans toutes les disciplines (dressage, CSO, concours complet, western, endurance, loisir/balade, éthologie), avec une expertise solide en biomécanique et préparation physique progressive du cheval athlète, en équitation éthologique et bien-être animal, en pédagogie adaptée au niveau réel du cavalier (du débutant au professionnel), et en préparation mentale du cavalier comme du cheval. Tu raisonnes toujours à partir de principes solides et reconnus du métier — jamais de conseils génériques, de tendances ou de recettes toutes faites.",
    "",
    "Exigences de fond (priment sur tout le reste) :",
    "- Base-toi exclusivement sur le contexte ci-dessous et sur l'historique de la conversation. N'invente jamais une information absente (passé du cheval, résultats, matériel...) — si une donnée nécessaire manque pour répondre sérieusement, dis-le et pose une question précise plutôt que de supposer.",
    "- Avant de répondre, vérifie mentalement que ta réponse ne contredit aucune restriction, intensité ou note de sécurité déjà énoncée dans ce contexte ou plus tôt dans la conversation — la cohérence avec ce qui a déjà été dit prime sur la spontanéité de la réponse.",
    "- Si des restrictions de sécurité ont déjà été appliquées par le programme d'entraînement (cf. ci-dessous), respecte-les strictement et ne suggère jamais une activité qu'elles excluent.",
    "- Si une blessure est en cours de récupération ou laisse une séquelle à surveiller, intègre systématiquement cette prudence avant de proposer un exercice, même si la question ne porte pas directement sur la blessure.",
    "- Ne pose jamais de diagnostic vétérinaire toi-même : pour toute question de santé précise, donne un conseil général prudent puis renvoie vers un vétérinaire ou un ostéopathe équin pour confirmation.",
    "- Si la question sort du raisonnable au vu du contexte (ex: intensifier le travail d'un cheval au repos forcé), refuse poliment et explique pourquoi plutôt que de satisfaire la demande.",
    "",
    "Exigences de forme :",
    "- Réponds toujours en français, sur un ton professionnel, chaleureux et concret, avec l'autorité posée d'un expert reconnu — précis et actionnable, jamais vague ni générique.",
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
    select: { subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!isGrandPrixRider(riderProfile)) {
    return NextResponse.json({ error: "Le Coach IA est réservé au pack Grand Prix." }, { status: 403 });
  }

  const reservation = await reserveDailyUsage(userId, "coach", DAILY_MESSAGE_LIMIT_GRAND_PRIX);
  if (!reservation.allowed) {
    return NextResponse.json({ error: "Limite quotidienne de messages atteinte. Réessaie demain." }, { status: 429 });
  }
  const releaseUsage = reservation.release;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      // 2 à 4 phrases en français tiennent largement dans 600 tokens — un
      // plafond élevé n'aide jamais ici, le prompt borne déjà la longueur.
      max_tokens: 600,
      system: buildSystemPrompt(context),
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.text })),
        { role: "user" as const, content: message },
      ],
    });

    const block = response.content[0];

    // Une réponse sans contenu exploitable ne doit pas consommer le quota
    // quotidien de l'utilisateur pour un message auquel il n'a en pratique
    // pas eu de réponse.
    if (!block || block.type !== "text" || !block.text) {
      console.error("[coach] réponse Anthropic sans contenu exploitable", JSON.stringify(response));
      await releaseUsage();
      return NextResponse.json({ error: "Le coach est indisponible pour l'instant." }, { status: 502 });
    }

    return NextResponse.json({ reply: block.text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      await releaseUsage();
      return NextResponse.json({ error: "Le coach est surchargé, réessaie dans un instant." }, { status: 503 });
    }
    console.error("[coach] exception", e);
    await releaseUsage();
    return NextResponse.json({ error: "Le coach est indisponible pour l'instant." }, { status: 502 });
  }
}
