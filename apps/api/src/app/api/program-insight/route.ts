import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

/** Phase de test : même contournement OpenRouter que /api/coach (cf. ce
 * fichier) tant que le compte Anthropic est à sec. */
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

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
const schema = z.object({
  horseName: z.string(),
  discipline: z.string().nullable(),
  riderGoal: z.string().nullable(),
  additionalInfo: z.string(),
  injuries: z.array(
    z.object({
      type: z.string(),
      recoveryStatus: z.string().nullable(),
      note: z.string().nullable(),
    })
  ),
  safetyNotes: z.array(z.string()),
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

  try {
    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 300,
        // Les modèles Anthropic exigent au moins un message "user" — sans ça
        // l'appel échoue systématiquement (cf. /api/coach, qui en a toujours
        // un). Le contexte/les instructions restent dans le system prompt ;
        // ce message ne fait que déclencher la réponse.
        messages: [
          { role: "system", content: buildSystemPrompt(parsed.data) },
          { role: "user", content: "Donne ton éclairage sur ce contexte." },
        ],
      }),
    });

    if (!openRouterRes.ok) {
      return NextResponse.json({ error: "Indisponible pour l'instant." }, { status: 502 });
    }

    const data = await openRouterRes.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    const note = content?.trim();

    return NextResponse.json({ note: !note || note === "RIEN" ? null : note });
  } catch {
    return NextResponse.json({ error: "Indisponible pour l'instant." }, { status: 502 });
  }
}
