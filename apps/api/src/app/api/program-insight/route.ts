import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { isGrandPrixRider } from "@/lib/subscription";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

/**
 * Complément IA au moteur de règles déterministe (cf. mobile/src/program/rules.ts) :
 * interprète le texte libre que les règles ignorent volontairement (notes du
 * cavalier, notes de blessure) plutôt que de tenter un pattern-matching
 * fragile côté règles. Les décisions de sécurité (restrictions de santé/
 * blessure, plafonds d'intensité) restent exclusivement déterministes — cette
 * route n'ajoute qu'un éclairage en langage naturel, jamais une structure de
 * séance. Appelée uniquement quand il y a du texte libre à interpréter (cf.
 * mobile/src/program/store.tsx), pas à chaque génération de programme.
 */
// Mêmes bornes que /api/coach (cf. ce fichier) — même raison : sans elles,
// rien ne plafonne le coût en tokens d'un appel au-delà du nombre d'appels.
const MAX_SHORT_TEXT = 100;
const MAX_NOTE_TEXT = 500;
const MAX_LIST_LENGTH = 20;

const schema = z.object({
  horseName: z.string().max(MAX_SHORT_TEXT),
  discipline: z.string().max(MAX_SHORT_TEXT).nullable(),
  riderGoal: z.string().max(MAX_SHORT_TEXT).nullable(),
  additionalInfo: z.string().max(MAX_NOTE_TEXT),
  injuries: z
    .array(
      z.object({
        type: z.string().max(MAX_SHORT_TEXT),
        recoveryStatus: z.string().max(MAX_SHORT_TEXT).nullable(),
        note: z.string().max(MAX_NOTE_TEXT).nullable(),
      })
    )
    .max(MAX_LIST_LENGTH),
  safetyNotes: z.array(z.string().max(MAX_NOTE_TEXT)).max(MAX_LIST_LENGTH),
});

function buildSystemPrompt(ctx: z.infer<typeof schema>): string {
  const injuryNotes = ctx.injuries
    .filter((i) => i.note?.trim())
    .map((i) => `- ${i.type}${i.recoveryStatus ? ` (${i.recoveryStatus})` : ""} : ${i.note}`);

  const lines = [
    "Tu es Julien, le coach IA de l'application Horsetrack.",
    "",
    `Un moteur de règles déterministe vient de générer le programme d'entraînement de ${ctx.horseName} (discipline : ${ctx.discipline ?? "non précisée"}${ctx.riderGoal ? `, objectif : ${ctx.riderGoal}` : ""}). Les restrictions de sécurité (santé, blessures) ont déjà été appliquées par ce moteur :`,
    ctx.safetyNotes.length ? ctx.safetyNotes.map((n) => `- ${n}`).join("\n") : "(aucune restriction particulière)",
    "",
    "Ton rôle ici n'est PAS de proposer un nouveau programme ni de contredire une restriction déjà appliquée : c'est d'apporter un éclairage personnalisé à partir du texte libre ci-dessous, que le moteur de règles ne sait pas interpréter.",
    "",
    `Notes libres du cavalier : "${ctx.additionalInfo.trim() || "(aucune)"}"`,
  ];

  if (injuryNotes.length) {
    lines.push("Notes libres sur les blessures :", ...injuryNotes);
  }

  lines.push(
    "",
    "Exigences :",
    "- 1 à 2 phrases, français, ton professionnel et chaleureux.",
    "- Jamais de liste à puces, jamais de markdown, jamais de diagnostic vétérinaire.",
    "- Relie concrètement une information du texte libre à la manière d'aborder le programme — ne répète pas les restrictions déjà listées plus haut, elles sont déjà affichées ailleurs.",
    "- Si le texte libre ne contient vraiment rien d'exploitable au-delà de ce qui est déjà couvert, réponds exactement \"RIEN\" sans autre texte plutôt que d'inventer un commentaire artificiel."
  );

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

  // Même restriction que /api/coach : l'éclairage IA du programme est réservé
  // au pack Grand Prix, mais jusqu'ici ce n'était vérifié que côté UI mobile
  // (cf. program/store.tsx) — n'importe quel compte authentifié pouvait
  // appeler cette route directement et consommer du crédit OpenRouter.
  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!isGrandPrixRider(riderProfile)) {
    return NextResponse.json({ error: "Cette fonctionnalité est réservée au pack Grand Prix." }, { status: 403 });
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: buildSystemPrompt(parsed.data),
      // Les modèles Anthropic exigent au moins un message "user" — sans ça
      // l'appel échoue systématiquement (cf. /api/coach, qui en a toujours
      // un). Le contexte/les instructions restent dans le system prompt ;
      // ce message ne fait que déclencher la réponse.
      messages: [{ role: "user", content: "Donne ton éclairage sur ce contexte." }],
    });

    const block = response.content[0];
    const note = block?.type === "text" ? block.text.trim() : undefined;

    return NextResponse.json({ note: !note || note === "RIEN" ? null : note });
  } catch {
    return NextResponse.json({ error: "Indisponible pour l'instant." }, { status: 502 });
  }
}
