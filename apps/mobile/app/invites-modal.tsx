import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useHorses } from "@/horses/store";
import { acceptInvite, pullPendingInvites, pullSharedHorses, type CollaboratorRole, type PendingInvite } from "@/lib/sharing";

const CARD = "rounded-card bg-surface p-5 shadow-card";

const ROLE_LABEL: Record<CollaboratorRole, string> = {
  DEMI_PENSION: "demi-pension",
  COACH: "coach",
  RIDER: "cavalière/cavalier",
  GROOM: "groom",
};

/** Affiché juste après connexion/inscription s'il existe au moins une
 * invitation en attente pour l'email du compte (cf. (auth)/login.tsx,
 * (onboarding)/paywall.tsx, lib/sharing.ts). */
export default function InvitesModal() {
  const { horses, hydrateFromCloud } = useHorses();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    pullPendingInvites().then((list) => {
      setInvites(list);
      setLoaded(true);
    });
  }, []);

  async function handleAccept(invite: PendingInvite) {
    setAcceptingId(invite.id);
    try {
      const ok = await acceptInvite(invite.id);
      if (!ok) {
        Alert.alert("Erreur", "Impossible d'accepter l'invitation pour l'instant. Réessaie plus tard.");
        return;
      }
      // Fusionne le cheval nouvellement accepté (et tout autre déjà
      // partagé) avec l'écurie possédée actuelle, sans attendre la
      // prochaine connexion pour le voir apparaître.
      const shared = await pullSharedHorses().catch(() => []);
      const ownedOnly = horses.filter((h) => !h.sharedRole);
      hydrateFromCloud([...ownedOnly, ...shared]);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } finally {
      setAcceptingId(null);
    }
  }

  function handleLater(inviteId: string) {
    // Ne supprime rien côté serveur : l'invitation reste PENDING et
    // resurgira à la prochaine connexion (cf. pullPendingInvites).
    setInvites((list) => list.filter((i) => i.id !== inviteId));
  }

  useEffect(() => {
    if (loaded && invites.length === 0) router.back();
  }, [loaded, invites.length]);

  if (!loaded || invites.length === 0) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-6">
        <Text className="text-2xl font-display tracking-tight text-text">
          {invites.length > 1 ? "Invitations en attente" : "Invitation en attente"}
        </Text>
        {invites.map((invite) => (
          <View key={invite.id} className={`${CARD} gap-3`}>
            <Text className="text-base text-text">
              Tu es invité·e à accéder au calendrier de <Text className="font-bold">{invite.horseName}</Text> en
              tant que <Text className="font-bold">{ROLE_LABEL[invite.role]}</Text>.
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
      </View>
    </SafeAreaView>
  );
}
