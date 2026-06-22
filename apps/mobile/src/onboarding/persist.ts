import { supabase } from "@/lib/supabase";
import type { HorseDraft, RiderDraft } from "@/onboarding/store";

/**
 * Génère un id compatible avec les colonnes `text` de Prisma. `@default(cuid())`
 * est une convention côté Prisma Client uniquement (pas un DEFAULT Postgres) —
 * comme on écrit ici directement via supabase-js (PostgREST), on doit fournir
 * nos propres ids, et `updatedAt` (qui n'a pas non plus de DEFAULT en base,
 * `@updatedAt` étant aussi géré côté client par Prisma).
 */
function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persiste les réponses d'onboarding dans Supabase (rider_profiles + horses +
 * horse_traits), scope par RLS via auth.uid(). Suppose qu'une session existe
 * déjà (créée dans (onboarding)/account.tsx) et que rls.sql a été appliqué à
 * la base — sans quoi rider_profiles n'a pas de ligne `users` correspondante
 * et l'insert échoue.
 */
export async function persistOnboarding(rider: RiderDraft, horses: HorseDraft[]): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw userError ?? new Error("Aucun utilisateur connecté.");
  }
  const userId = userData.user.id;
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("rider_profiles")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  const riderProfileFields = {
    level: rider.level,
    mainDiscipline: rider.mainDiscipline,
    rideFrequency: rider.rideFrequency,
    primaryGoal: rider.primaryGoal,
    additionalInfo: rider.additionalInfo.trim() || null,
    onboardingCompletedAt: now,
    updatedAt: now,
  };

  let ownerId: string;
  if (existing) {
    ownerId = existing.id as string;
    const { error } = await supabase.from("rider_profiles").update(riderProfileFields).eq("id", ownerId);
    if (error) throw error;
  } else {
    ownerId = generateId();
    const { error } = await supabase
      .from("rider_profiles")
      .insert({ id: ownerId, userId, ...riderProfileFields });
    if (error) throw error;
  }

  for (const horse of horses) {
    const horseId = generateId();
    const { error: horseError } = await supabase.from("horses").insert({
      id: horseId,
      ownerId,
      name: horse.name,
      photoUrl: horse.photoUrl,
      birthYear: horse.birthYear,
      sex: horse.sex,
      breed: horse.breed,
      coat: horse.coat,
      heightCm: horse.heightCm,
      weightKg: horse.weightKg,
      discipline: horse.discipline,
      level: horse.level,
      fitnessLevel: horse.fitnessLevel,
      workload: horse.workload,
      isPrimary: horse.isPrimary,
      updatedAt: now,
    });
    if (horseError) throw horseError;

    const traits = [
      ...horse.strengths.map((tag) => ({ tag, kind: "STRENGTH" as const })),
      ...horse.weaknesses.map((tag) => ({ tag, kind: "WEAKNESS" as const })),
      ...horse.temperament.map((tag) => ({ tag, kind: "TEMPERAMENT" as const })),
      ...horse.healthConditions.map((tag) => ({ tag, kind: "HEALTH_CONDITION" as const })),
    ];
    if (traits.length > 0) {
      const { error: traitsError } = await supabase
        .from("horse_traits")
        .insert(traits.map((t) => ({ id: generateId(), horseId, tag: t.tag, kind: t.kind })));
      if (traitsError) throw traitsError;
    }

    if (horse.injuries.length === 0) continue;

    const { error: injuriesError } = await supabase.from("horse_injuries").insert(
      horse.injuries.map((injury) => ({
        id: generateId(),
        horseId,
        type: injury.type,
        occurredAt: injury.occurredAt?.toISOString() ?? null,
        recoveryStatus: injury.recoveryStatus,
        note: injury.note.trim() || null,
        updatedAt: now,
      }))
    );
    if (injuriesError) throw injuriesError;
  }
}
