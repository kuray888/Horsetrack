import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { QUOTAS } from "@/lib/coach/config";
import { runSuggestion } from "@/lib/coach/engine";
import { suggestionRequestSchema, type CoachSuggestion } from "@/lib/coach/schemas";
import { suggestionDay } from "@/lib/coach/validate";
import { canAccessHorse, coachAvailable, isPremiumUser, logCall } from "@/lib/coach/store";

/**
 * « Ta prochaine séance » (Premium). L'app envoie les faits, les contraintes
 * et la liste des exercices autorisés, tous calculés par son code, plus la
 * suggestion de repli qu'elle a calculée elle-même.
 *
 * Une suggestion IA par cheval et par jour : la suivante, le même jour, est
 * relue en base. Repos imposé par les contraintes : pas d'appel au modèle.
 * Coach coupé ou plafond atteint : la suggestion du code, avec un statut
 * « unavailable » que l'app affiche proprement.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = suggestionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const body = parsed.data;
  const fallback: CoachSuggestion = { ...body.fallback, source: "code" };

  if (!(await isPremiumUser(userId))) return NextResponse.json({ status: "premium" }, { status: 403 });
  if (!(await canAccessHorse(userId, body.horseId))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const day = suggestionDay(body.facts.today);
  const cached = await db.coachSuggestion.findUnique({ where: { userId_horseId_day: { userId, horseId: body.horseId, day } } });
  if (cached) return NextResponse.json({ status: "ok", suggestion: cached.result, cached: true });

  if (!(await coachAvailable())) return NextResponse.json({ status: "unavailable", suggestion: fallback });

  let suggestion: CoachSuggestion = fallback;
  if (!body.constraints.restRequired) {
    const today = await db.coachSuggestion.count({ where: { userId, day } });
    if (today >= QUOTAS.suggestionHorsesPerDay) return NextResponse.json({ status: "quota", suggestion: fallback });

    const result = await runSuggestion(new Anthropic(), body);
    await logCall({
      userId,
      kind: "suggestion",
      status: result.outcome,
      usage: result.usage,
      costUsd: result.costUsd,
      errorCode: result.errors.join(",").slice(0, 200) || null,
    });
    // Erreur réseau ou API : rien n'est gardé, la suivante pourra réessayer.
    if (result.outcome === "error") return NextResponse.json({ status: "unavailable", suggestion: fallback });
    suggestion = result.value;
  }

  try {
    await db.coachSuggestion.create({ data: { userId, horseId: body.horseId, day, result: suggestion } });
  } catch (e) {
    // Deux demandes simultanées : la première gagne, sa réponse est relue.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return NextResponse.json({ status: "ok", suggestion });
}
