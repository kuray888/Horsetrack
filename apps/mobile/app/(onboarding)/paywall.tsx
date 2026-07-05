import { Alert } from "react-native";
import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, type BillingPeriod } from "@/subscription/store";
import type { PaidTier } from "@/lib/revenuecat";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { useOnboarding } from "@/onboarding/store";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { pullCloudData } from "@/lib/cloudSync";
import { pullPendingInvites } from "@/lib/sharing";

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
        "Ce compte avait déjà un programme — tes réponses d'inscription n'ont pas été utilisées, on a restauré tes données existantes."
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

  async function onSubscribe(tier: PaidTier, period: BillingPeriod) {
    await subscribe(tier, period, finish);
  }

  // « Plus tard » : entre dans l'app en mode gaté (palier Free).
  function onClose() {
    finish();
  }

  // Aide à la décision : un cavalier qui a déjà saisi plus de chevaux que ne
  // permet Paddock (2) doit voir Grand Prix présélectionné d'emblée.
  const initialTier = horses.length > 2 ? "GRAND_PRIX" : horses.length === 2 ? "PADDOCK" : "GRAND_PRIX";

  return (
    <PaywallView
      onSubscribe={onSubscribe}
      onClose={onClose}
      onRestore={restore}
      submitting={submitting}
      restoring={restoring}
      initialTier={initialTier}
    />
  );
}
