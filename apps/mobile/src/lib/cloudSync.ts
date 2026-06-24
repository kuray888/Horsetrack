import { supabase } from "@/lib/supabase";
import type { RiderProfile } from "@/rider/store";
import type { Horse } from "@/horses/store";

/**
 * Sauvegarde cloud des données irremplaçables (écurie + profil cavalier) —
 * progression/agenda/programme restent local-only pour l'instant (cf.
 * mémoire projet "données local-first"), ce sont elles qu'on perdrait sans ça
 * sur changement de téléphone ou réinstallation. Best-effort partout : un
 * échec réseau ne doit jamais bloquer l'usage de l'app, seulement retarder la
 * sauvegarde au prochain appel.
 *
 * Les ids locaux (Horse.id, Injury.id) servent aussi d'id Postgres — pas de
 * table de correspondance à maintenir, un push réutilise toujours la même
 * ligne plutôt que d'en créer une nouvelle à chaque appel.
 */

function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function getOwnerProfile(userId: string): Promise<{ id: string; onboardingCompletedAt: string | null } | null> {
  const { data } = await supabase
    .from("rider_profiles")
    .select("id, onboardingCompletedAt")
    .eq("userId", userId)
    .maybeSingle();
  return data ?? null;
}

export async function pushRiderProfile(rider: RiderProfile): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const now = new Date().toISOString();
  const existing = await getOwnerProfile(userId);
  const fields = {
    level: rider.level,
    mainDiscipline: rider.mainDiscipline,
    rideFrequency: rider.rideFrequency,
    primaryGoal: rider.primaryGoal,
    additionalInfo: rider.additionalInfo.trim() || null,
    // Ne se pose qu'une fois — sert de signal "ce compte a déjà un profil
    // complet côté serveur" pour pullCloudData(), pas d'horodatage d'édition.
    onboardingCompletedAt: existing?.onboardingCompletedAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    await supabase.from("rider_profiles").update(fields).eq("id", existing.id);
  } else {
    await supabase.from("rider_profiles").insert({ id: generateId(), userId, ...fields });
  }
}

async function pushHorseTraitsAndInjuries(horse: Horse): Promise<void> {
  const traitRows = [
    ...horse.strengths.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "STRENGTH" })),
    ...horse.weaknesses.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "WEAKNESS" })),
    ...horse.temperament.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "TEMPERAMENT" })),
    ...horse.healthConditions.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "HEALTH_CONDITION" })),
  ];
  // Pas d'id de tag stable côté local : on remplace tout plutôt que de tenter
  // un diff précis, le volume par cheval est trop faible pour que ça coûte.
  await supabase.from("horse_traits").delete().eq("horseId", horse.id);
  if (traitRows.length > 0) await supabase.from("horse_traits").insert(traitRows);

  const now = new Date().toISOString();
  // recoveryStatus est NOT NULL côté DB ; le type local l'autorise à null tant
  // qu'une blessure est en cours de saisie (cf. InjuryHistoryField), mais le
  // formulaire bloque l'ajout avant qu'il soit renseigné — filtre défensif.
  const injuries = horse.injuries.filter((i) => i.recoveryStatus !== null);
  if (injuries.length > 0) {
    await supabase.from("horse_injuries").upsert(
      injuries.map((i) => ({
        id: i.id,
        horseId: horse.id,
        type: i.type,
        occurredAt: i.occurredAt?.toISOString() ?? null,
        recoveryStatus: i.recoveryStatus,
        note: i.note.trim() || null,
        updatedAt: now,
      }))
    );
  }
  const { data: remoteInjuries } = await supabase.from("horse_injuries").select("id").eq("horseId", horse.id);
  const injuryIds = injuries.map((i) => i.id);
  const staleInjuryIds = (remoteInjuries ?? []).map((r) => r.id).filter((id) => !injuryIds.includes(id));
  if (staleInjuryIds.length > 0) await supabase.from("horse_injuries").delete().in("id", staleInjuryIds);
}

export async function pushHorses(horses: Horse[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const profile = await getOwnerProfile(userId);
  // Pas encore de rider_profile côté serveur (ex: confirmation email en
  // attente, cf. (onboarding)/account.tsx) : on retentera au prochain push,
  // pushRiderProfile() crée la ligne dès qu'une session existe.
  if (!profile) return;

  const now = new Date().toISOString();
  if (horses.length > 0) {
    await supabase.from("horses").upsert(
      horses.map((h) => ({
        id: h.id,
        ownerId: profile.id,
        name: h.name,
        photoUrl: h.photoUrl,
        birthYear: h.birthYear,
        sex: h.sex,
        breed: h.breed,
        heightCm: h.heightCm,
        weightKg: h.weightKg,
        discipline: h.discipline,
        level: h.level,
        fitnessLevel: h.fitnessLevel,
        workload: h.workload,
        isPrimary: h.isPrimary,
        updatedAt: now,
      }))
    );
  }

  // Supprime côté distant les chevaux qui n'existent plus localement — pas de
  // suppression de cheval dans l'UI actuelle, mais garde la sync correcte le
  // jour où elle arrive plutôt que de laisser des chevaux fantômes.
  const { data: remoteHorses } = await supabase.from("horses").select("id").eq("ownerId", profile.id);
  const localIds = horses.map((h) => h.id);
  const staleHorseIds = (remoteHorses ?? []).map((r) => r.id).filter((id) => !localIds.includes(id));
  if (staleHorseIds.length > 0) await supabase.from("horses").delete().in("id", staleHorseIds);

  for (const horse of horses) {
    await pushHorseTraitsAndInjuries(horse);
  }
}

type CloudData = { rider: RiderProfile; horses: Horse[] };

/**
 * Restaure écurie + profil cavalier depuis Supabase — appelé uniquement
 * quand cet appareil n'a pas (ou plus) les données locales du compte qui
 * vient de se connecter (cf. (auth)/login.tsx). Renvoie null si ce compte n'a
 * jamais terminé l'onboarding côté serveur (rien à restaurer).
 */
export async function pullCloudData(): Promise<CloudData | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("rider_profiles")
    .select("*, horses(*, horse_traits(*), horse_injuries(*))")
    .eq("userId", userId)
    .maybeSingle();

  // Une erreur réseau/serveur ne doit JAMAIS être interprétée comme "ce compte
  // n'a pas de données" (cf. (auth)/login.tsx, qui sinon repartirait d'un
  // état vide puis supprimerait les vraies données distantes au prochain push
  // — cf. pushHorses ci-dessous, qui efface côté serveur tout cheval absent
  // du local).
  if (error) throw error;
  if (!profile || !profile.onboardingCompletedAt) return null;

  const rider: RiderProfile = {
    level: profile.level,
    mainDiscipline: profile.mainDiscipline,
    rideFrequency: profile.rideFrequency,
    primaryGoal: profile.primaryGoal,
    additionalInfo: profile.additionalInfo ?? "",
  };

  type RemoteTrait = { tag: string; kind: string };
  type RemoteInjury = {
    id: string;
    type: string;
    occurredAt: string | null;
    recoveryStatus: Horse["injuries"][number]["recoveryStatus"];
    note: string | null;
  };
  type RemoteHorse = Omit<Horse, "emoji" | "strengths" | "weaknesses" | "temperament" | "healthConditions" | "restDayActivities" | "injuries"> & {
    horse_traits: RemoteTrait[];
    horse_injuries: RemoteInjury[];
  };

  const remoteHorses = (profile.horses ?? []) as RemoteHorse[];
  const horses: Horse[] = remoteHorses.map((h) => ({
    ...h,
    emoji: "🐴",
    strengths: h.horse_traits.filter((t) => t.kind === "STRENGTH").map((t) => t.tag),
    weaknesses: h.horse_traits.filter((t) => t.kind === "WEAKNESS").map((t) => t.tag),
    temperament: h.horse_traits.filter((t) => t.kind === "TEMPERAMENT").map((t) => t.tag),
    healthConditions: h.horse_traits.filter((t) => t.kind === "HEALTH_CONDITION").map((t) => t.tag),
    // Pas encore synchronisé côté serveur (cf. décision lors de son ajout) —
    // l'utilisateur devra le ressaisir une fois après une restauration.
    restDayActivities: [],
    injuries: h.horse_injuries.map((i) => ({
      id: i.id,
      type: i.type,
      occurredAt: i.occurredAt ? new Date(i.occurredAt) : null,
      recoveryStatus: i.recoveryStatus,
      note: i.note ?? "",
    })),
  }));

  return { rider, horses };
}
