import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { isGrandPrixRider } from "@/lib/subscription";
import { reserveDailyUsage } from "@/lib/usageLimit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

/** Cette route est appelée automatiquement par le client (cf.
 * mobile/src/program/store.tsx), au plus une fois par changement de texte
 * libre — un usage légitime tourne autour de 1 à 3 appels/jour. Plafond
 * généreux pour ne jamais gêner un usage normal, mais borné pour éviter
 * qu'un appel direct à la route (hors client officiel) fasse grimper le
 * coût API sans limite — cette route n'avait jusqu'ici aucun plafond,
 * contrairement à /api/coach. */
const DAILY_INSIGHT_LIMIT = 30;

/**
 * Complément IA au moteur de règles déterministe (cf. mobile/src/program/rules.ts) :
 * interprète le texte libre que les règles ignorent volontairement (notes du
 * cavalier, notes de blessure) plutôt que de tenter un pattern-matching
 * fragile côté règles. Les décisions de sécurité (restrictions de santé/
 * blessure, plafonds d'intensité, exclusion de types de séance) restent
 * exclusivement déterministes — cette route ne fait jamais que AJOUTER un
 * éclairage/un exercice ponctuel par-dessus le programme déjà généré, jamais
 * le remplacer ni en modifier la structure. Appelée uniquement quand il y a
 * du texte libre à interpréter (cf. mobile/src/program/store.tsx), pas à
 * chaque génération de programme.
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
    "Ton rôle ici n'est PAS de proposer un nouveau programme ni de contredire une restriction déjà appliquée : c'est d'apporter un éclairage personnalisé, et éventuellement UN exercice complémentaire ponctuel, à partir du texte libre ci-dessous que le moteur de règles ne sait pas interpréter.",
    "",
    `Notes libres du cavalier : "${ctx.additionalInfo.trim() || "(aucune)"}"`,
  ];

  if (injuryNotes.length) {
    lines.push("Notes libres sur les blessures :", ...injuryNotes);
  }

  lines.push(
    "",
    "Deux livrables distincts, à produire EXACTEMENT dans ce format (3 lignes, un champ par ligne, sans rien avant/après) :",
    "NOTE: <1 à 2 phrases ou RIEN>",
    "EXERCICE_TITRE: <titre court, 6 mots max, ou RIEN>",
    "EXERCICE_DESCRIPTION: <1 à 2 phrases décrivant précisément l'exercice ou RIEN>",
    "",
    "Règles pour NOTE :",
    "- Français, ton professionnel et chaleureux, jamais de liste à puces ni de markdown, jamais de diagnostic vétérinaire.",
    "- Relie concrètement une information du texte libre à la manière d'aborder le programme — ne répète pas les restrictions déjà listées plus haut, elles sont déjà affichées ailleurs.",
    "- Si le texte libre ne contient rien d'exploitable au-delà de ce qui est déjà couvert, réponds exactement \"RIEN\".",
    "",
    "Règles pour EXERCICE_TITRE / EXERCICE_DESCRIPTION (un SEUL exercice bonus, optionnel) :",
    "- Uniquement si le texte libre appelle vraiment un exercice concret et sûr en plus de ce qui est déjà prévu (ex: \"il est stressé par les nouveaux objets en ce moment\" → un exercice court de désensibilisation). Dans le doute, réponds \"RIEN\" aux deux champs plutôt que d'inventer.",
    "- Cet exercice est un COMPLÉMENT ponctuel ajouté à une séance déjà prévue, jamais une séance à part entière : reste léger (5 à 10 minutes), n'augmente jamais l'intensité globale, et ne propose JAMAIS un exercice technique de saut ou d'obstacle, même si rien ne l'interdit explicitement — ce niveau de risque reste réservé aux séances déjà structurées par le moteur de règles.",
    "- Ne propose jamais un exercice qui contredit, même partiellement, une restriction listée plus haut.",
    "- EXERCICE_DESCRIPTION doit être une consigne actionnable (quoi faire, combien de temps, à quoi veiller), pas une simple reformulation du titre."
  );

  return lines.join("\n");
}

type ProgramInsightResult = {
  note: string | null;
  bonusExercise: { title: string; description: string } | null;
};

/** Parse le format à 3 lignes imposé au modèle (cf. buildSystemPrompt) —
 * volontairement pas de JSON : les modèles suivent plus fidèlement un format
 * texte simple avec labels explicites, et une ligne mal formée dégrade
 * proprement (champ ignoré) plutôt que de faire échouer tout le parsing JSON. */
function parseInsightResponse(content: string): ProgramInsightResult {
  const field = (label: string): string | null => {
    const match = content.match(new RegExp(`^${label}:\\s*(.*)$`, "im"));
    const value = match?.[1]?.trim();
    return !value || value.toUpperCase() === "RIEN" ? null : value;
  };

  const note = field("NOTE");
  const title = field("EXERCICE_TITRE");
  const description = field("EXERCICE_DESCRIPTION");

  return {
    note,
    bonusExercise: title && description ? { title, description } : null,
  };
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
  // appeler cette route directement et consommer du crédit API.
  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!isGrandPrixRider(riderProfile)) {
    return NextResponse.json({ error: "Cette fonctionnalité est réservée au pack Grand Prix." }, { status: 403 });
  }

  const reservation = await reserveDailyUsage(userId, "program_insight", DAILY_INSIGHT_LIMIT);
  if (!reservation.allowed) {
    return NextResponse.json({ error: "Limite quotidienne atteinte. Réessaie demain." }, { status: 429 });
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
    const content = block?.type === "text" ? block.text.trim() : undefined;

    // Pas de reservation.release() ici (cf. audit sécurité, "frais cachés") :
    // la réponse a été reçue et donc DÉJÀ FACTURÉE par Anthropic, même si
    // son contenu est vide/inexploitable — cf. coach/route.ts, même logique.
    return NextResponse.json(content ? parseInsightResponse(content) : { note: null, bonusExercise: null });
  } catch {
    await reservation.release();
    return NextResponse.json({ error: "Indisponible pour l'instant." }, { status: 502 });
  }
}
