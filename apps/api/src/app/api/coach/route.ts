import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, SubscriptionStatus, SubscriptionTier } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

/** Phase de test : passe par OpenRouter (cf. OPENROUTER_API_KEY) au lieu d'Anthropic
 * en direct, le compte Anthropic étant à sec — à revenir sur le SDK Anthropic une fois
 * le crédit reconstitué (cf. mémoire projet "coach-mocked"). */
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

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

function isGrandPrixRider(
  rider: { subscriptionTier: SubscriptionTier; subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null } | null
): boolean {
  if (!rider) return false;
  if (rider.subscriptionTier !== SubscriptionTier.GRAND_PRIX) return false;
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

  const today = new Date().toISOString().slice(0, 10);

  // Incrémente d'abord, vérifie ensuite : un read-then-write (lire le compteur,
  // comparer, puis écrire seulement après l'appel LLM) laisse une fenêtre de
  // course où deux requêtes concurrentes lisent le même compteur avant
  // incrément et passent toutes les deux la limite. L'incrément Prisma se
  // traduit en `UPDATE ... SET count = count + 1`, atomique côté Postgres, donc
  // plus de fenêtre de course. En contrepartie, on décrémente explicitement
  // dans toutes les branches d'échec ci-dessous pour ne jamais facturer un
  // message qui n'a pas obtenu de réponse exploitable.
  const usage = await db.coachUsage.upsert({
    where: { userId_date: { userId, date: today } },
    update: { count: { increment: 1 } },
    create: { userId, date: today, count: 1 },
  });

  const releaseUsage = () =>
    db.coachUsage
      .update({ where: { userId_date: { userId, date: today } }, data: { count: { decrement: 1 } } })
      .catch(() => {});

  if (usage.count > DAILY_MESSAGE_LIMIT_GRAND_PRIX) {
    await releaseUsage();
    return NextResponse.json({ error: "Limite quotidienne de messages atteinte. Réessaie demain." }, { status: 429 });
  }

  try {
    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        // 2 à 4 phrases en français tiennent largement dans 600 tokens — un
        // plafond élevé n'aide jamais ici (le prompt borne déjà la longueur),
        // et certains fournisseurs (cf. OpenRouter) réservent ce montant contre
        // le crédit disponible avant même de générer, donc un plafond trop
        // haut peut faire échouer une requête qui aurait largement tenu dans
        // le crédit réellement consommé.
        max_tokens: 600,
        messages: [
          { role: "system", content: buildSystemPrompt(context) },
          ...history.map((h) => ({ role: h.role, content: h.text })),
          { role: "user", content: message },
        ],
      }),
    });

    if (openRouterRes.status === 429) {
      await releaseUsage();
      return NextResponse.json({ error: "Le coach est surchargé, réessaie dans un instant." }, { status: 503 });
    }
    if (!openRouterRes.ok) {
      console.error("[coach] OpenRouter error", openRouterRes.status, await openRouterRes.text().catch(() => ""));
      await releaseUsage();
      return NextResponse.json({ error: "Le coach est indisponible pour l'instant." }, { status: 502 });
    }

    const data = await openRouterRes.json();
    const choice = data.choices?.[0]?.message;

    // Une réponse sans contenu exploitable (choices vide, content manquant) ne
    // doit pas consommer le quota quotidien de l'utilisateur pour un message
    // auquel il n'a en pratique pas eu de réponse.
    if (!choice?.refusal && !choice?.content) {
      console.error("[coach] réponse OpenRouter sans contenu exploitable", JSON.stringify(data));
      await releaseUsage();
      return NextResponse.json({ error: "Le coach est indisponible pour l'instant." }, { status: 502 });
    }

    const reply: string = choice.refusal
      ? "Désolé, je ne peux pas répondre à ça — pose-moi une question sur l'entraînement, la santé ou la progression de ton cheval."
      : choice.content;

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[coach] exception", e);
    await releaseUsage();
    return NextResponse.json({ error: "Le coach est indisponible pour l'instant." }, { status: 502 });
  }
}
