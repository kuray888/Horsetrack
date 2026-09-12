import { Alert } from "react-native";
import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { maxHorses, useSubscribeFlow, useSubscription, type BillingPeriod } from "@/subscription/store";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { useOnboarding } from "@/onboarding/store";
import { RIDER_LEVEL_TO_HORSE_LEVEL } from "@/onboarding/options";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { pullCloudData, pushRiderProfile } from "@/lib/cloudSync";
import { pullPendingInvites } from "@/lib/sharing";

/** Pivot freemium du 2026-09-03 (v2) : présente l'abonnement Premium à la fin
 * de l'onboarding, mais reste "skippable" via onSkip — contrairement à
 * l'ancien palier unique, il existe un vrai palier gratuit permanent pour
 * continuer sans payer (cf. PaywallView "Continuer avec le palier gratuit"). */
export default function OnboardingPaywall() {
  const { rider, horses } = useOnboarding();
  const { replaceHorses, hydrateFromCloud } = useHorses();
  const { setRiderProfile } = useRiderProfile();
  const { submitting, subscribe, restoring, restore } = useSubscribeFlow();
  const subscription = useSubscription();

  async function finish() {
    // Ce compte a-t-il déjà terminé l'onboarding ailleurs ? Cas réel : sur
    // account.tsx, un email déjà utilisé propose "connecte-toi plutôt" — une
    // fois connecté, on atterrit quand même ici avec un brouillon d'onboarding
    // local (chevaux/réponses bidon). Sans ce contrôle, replaceHorses()
    // écraserait la vraie écurie du compte, et pushHorses() (cf. cloudSync.ts)
    // supprimerait ensuite côté serveur tout cheval absent de ce brouillon —
    // perte de données irréversible constatée en pratique. Erreur réseau ⇒ on
    // suppose "compte neuf" comme avant plutôt que de bloquer tout l'onboarding.
    const existing = await pullCloudData().catch(() => null);
    if (existing) {
      setRiderProfile(existing.rider);
      hydrateFromCloud(existing.horses);
      Alert.alert(
        "Compte existant retrouvé",
        "Ce compte avait déjà une écurie — tes réponses d'inscription n'ont pas été utilisées, on a restauré tes données existantes."
      );
    } else {
      // setRiderProfile()/replaceHorses() persistent localement ET poussent vers
      // le cloud en best-effort (cf. lib/cloudSync.ts).
      // L'onboarding ne propose pas encore de type d'objectif personnalisé
      // (cf. edit-rider-modal.tsx, seul écran à l'offrir pour l'instant).
      const newRider = { ...rider, primaryGoalCustom: null };
      setRiderProfile(newRider);
      // Sans cet await, le push de replaceHorses() ci-dessous (pushHorses,
      // cf. cloudSync.ts) démarre son propre getOwnerProfile() quasiment en
      // même temps que celui déclenché par setRiderProfile() — un aller-retour
      // réseau contre deux (SELECT+INSERT) : pushHorses le perd presque à
      // chaque fois, trouve encore aucune ligne rider_profiles et abandonne
      // silencieusement (return []), sans jamais réessayer derrière. L'écurie
      // créée à l'onboarding restait alors locale-only, invisible tant que
      // l'utilisateur ne réinstallait pas l'app / ne changeait pas d'appareil
      // (cf. audit du 2026-09-09).
      await pushRiderProfile(newRider).catch(() => {});
      // Le profil sportif du cheval (discipline/niveau) n'est plus demandé à
      // l'onboarding (cf. onboarding/options.ts) — un cheval hérite par défaut
      // de la discipline/du niveau déjà déclarés par le cavalier plutôt que de
      // rester sans discipline/niveau (requis, cf. replaceHorses qui écarterait
      // sinon silencieusement tout cheval qui ne les a pas).
      const horsesWithSportProfile = horses.map((h) => ({
        ...h,
        discipline: h.discipline ?? rider.mainDiscipline,
        level: h.level ?? (rider.level ? RIDER_LEVEL_TO_HORSE_LEVEL[rider.level] : "CLUB"),
      }));
      // horses.tsx laisse ajouter autant de chevaux qu'on veut pendant
      // l'onboarding (juste un avertissement textuel "le premier est
      // gratuit, les suivants avec Premium"), sans bloquer — la décision
      // gratuit/Premium n'est prise qu'ici, à la toute fin. Sans cette
      // troncature, un compte resté gratuit voyait les chevaux en trop
      // apparaître normalement en local (éditables, utilisables partout)
      // alors que le serveur les rejette silencieusement un par un (cf.
      // rls.sql horses_insert_own + cloudSync.ts pushHorses) : des chevaux
      // fantômes qui disparaîtraient sans prévenir à la moindre réinstallation
      // ou changement d'appareil (cf. audit du 2026-09-12). Garde le cheval
      // principal en priorité, cohérent avec l'étoile déjà affichée sur
      // horses.tsx.
      const limit = maxHorses(subscription);
      const withinLimit =
        horsesWithSportProfile.length <= limit
          ? horsesWithSportProfile
          : [...horsesWithSportProfile].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).slice(0, limit);
      replaceHorses(withinLimit);
      if (withinLimit.length < horsesWithSportProfile.length) {
        Alert.alert(
          "Un seul cheval sur le palier gratuit",
          `Le palier gratuit est limité à 1 cheval — seul ${withinLimit[0]?.name ?? "ton premier cheval"} a été conservé. Passe à Premium depuis ton profil pour ajouter les autres.`
        );
      }
    }
    // Le compte créé juste avant (cf. account.tsx) donne une session dans le
    // cas standard. Si la confirmation par email est activée côté Supabase, la
    // session n'existe pas encore et le push échoue silencieusement — il sera
    // retenté à la prochaine modification, ou au prochain login.
    await markOnboardingCompleted();
    // Signale une éventuelle invitation reçue avant l'inscription (cf.
    // lib/sharing.ts) — le cheval partagé lui-même n'apparaîtra qu'à la
    // prochaine connexion (cf. (auth)/login.tsx, qui fusionne pullSharedHorses
    // avec l'écurie possédée), limite acceptée pour ce cas rare.
    const invites = await pullPendingInvites().catch(() => []);
    router.replace("/(tabs)/today");
    if (invites.length > 0) router.push("/invites-modal");
  }

  async function onSubscribe(period: BillingPeriod) {
    await subscribe(period, finish);
  }

  return (
    <PaywallView
      onSubscribe={onSubscribe}
      onSkip={finish}
      onRestore={restore}
      submitting={submitting}
      restoring={restoring}
    />
  );
}
