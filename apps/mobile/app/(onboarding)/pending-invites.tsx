import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { acceptInvite, pullPendingInvites, pullSharedHorses, ROLE_LABEL_SHORT, type PendingInvite } from "@/lib/sharing";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Atteint juste après la création de compte (cf. (onboarding)/account.tsx) si
 * l'email utilisé a au moins une invitation de partage en attente — évite à
 * un coach/groom/demi-pension invité de devoir répondre aux questions de
 * profil cavalier et créer un cheval fictif avant de pouvoir accepter le
 * partage qui est la seule raison de son inscription (cf. audit produit du
 * 2026-09-08). Accepter au moins une invitation ici saute directement dans
 * l'app ; ne rien accepter renvoie vers le parcours normal (les invitations
 * restent PENDING et resurgiront après le paywall, cf. (onboarding)/
 * paywall.tsx, exactement comme pour un compte existant qui se connecte).
 */
export default function PendingInvitesOnboarding() {
  const { horses, hydrateFromCloud } = useHorses();
  const { riderProfile, setRiderProfile } = useRiderProfile();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const acceptedAny = useRef(false);

  useEffect(() => {
    pullPendingInvites()
      .then((list) => {
        setInvites(list);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function continueToOwnProfile() {
    // Les invitations non traitées restent PENDING côté serveur — resurgiront
    // après le paywall (cf. paywall.tsx), aucune perte.
    router.replace("/(onboarding)/rider-level");
  }

  useEffect(() => {
    if (!loaded || invites.length > 0) return;
    if (acceptedAny.current) {
      // Ce parcours ne passe jamais par (onboarding)/paywall.tsx, seul autre
      // endroit qui appelle setRiderProfile() — sans cet appel ici, aucune
      // ligne rider_profiles n'existerait jamais côté serveur pour ce compte
      // (getOwnerProfile() y échouerait indéfiniment), bloquant silencieusement
      // toute synchro cloud si cette personne ajoute un jour son propre
      // cheval/document/objectif. Valeurs par défaut : rien n'a été demandé
      // dans ce parcours, ajustable plus tard depuis Profil (cf. audit du
      // 2026-09-09).
      setRiderProfile(riderProfile);
      markOnboardingCompleted().finally(() => router.replace("/(tabs)/today"));
    } else {
      continueToOwnProfile();
    }
  }, [loaded, invites.length]);

  async function handleAccept(invite: PendingInvite) {
    setAcceptingId(invite.id);
    try {
      const ok = await acceptInvite(invite.id);
      if (ok) {
        acceptedAny.current = true;
        const shared = (await pullSharedHorses().catch(() => null)) ?? [];
        const ownedOnly = horses.filter((h) => !h.sharedRole);
        hydrateFromCloud([...ownedOnly, ...shared]);
      }
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } catch {
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } finally {
      setAcceptingId(null);
    }
  }

  function handleLater(inviteId: string) {
    setInvites((list) => list.filter((i) => i.id !== inviteId));
  }

  if (!loaded || invites.length === 0) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <View className="gap-2">
          <Text className="text-2xl font-display tracking-tight text-text">
            {invites.length > 1 ? "Invitations en attente" : "Invitation en attente"}
          </Text>
          <Text className="text-base text-muted">
            Quelqu&apos;un t&apos;a invité·e à suivre son cheval sur Horsetrack.
          </Text>
        </View>

        {invites.map((invite) => (
          <View key={invite.id} className={`${CARD} gap-3`}>
            <Text className="text-base text-text">
              Tu es invité·e à accéder à la fiche de <Text className="font-bold">{invite.horseName}</Text> (planning,
              santé, journal, budget) en tant que <Text className="font-bold">{ROLE_LABEL_SHORT[invite.role]}</Text>.
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => handleLater(invite.id)}
                className="flex-1 items-center rounded-card border border-border p-3"
              >
                <Text className="text-sm font-semibold text-muted">Plus tard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAccept(invite)}
                disabled={acceptingId === invite.id}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-card bg-primary p-3"
              >
                <Text className="text-sm font-bold text-on-primary">
                  {acceptingId === invite.id ? "…" : "Accepter"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={continueToOwnProfile} hitSlop={8}>
          <Text className="text-center text-sm font-semibold text-accent">
            Configurer mon propre profil à la place
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
