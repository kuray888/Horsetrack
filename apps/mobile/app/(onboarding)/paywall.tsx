import { Alert } from "react-native";
import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, type BillingPeriod } from "@/subscription/store";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { useOnboarding } from "@/onboarding/store";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { pullCloudData } from "@/lib/cloudSync";
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
      setRiderProfile(rider);
      replaceHorses(horses);
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
