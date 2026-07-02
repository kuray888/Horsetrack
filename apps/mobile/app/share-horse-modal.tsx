import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/onboarding";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import {
  inviteCollaborator,
  listCollaborators,
  revokeCollaborator,
  type Collaborator,
  type CollaboratorRole,
} from "@/lib/sharing";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

const ROLE_META: Record<CollaboratorRole, { label: string; icon: string }> = {
  DEMI_PENSION: { label: "Demi-pension", icon: "🤝" },
  COACH: { label: "Coach / enseignant", icon: "🎓" },
};

const STATUS_META: Record<Collaborator["status"], string> = {
  PENDING: "En attente",
  ACCEPTED: "Actif",
};

/** Réservé à Paddock+ et 1 collaborateur par cheval (cf. grille tarifaire) —
 * même pattern d'upsell que add-horse-modal.tsx pour la limite de chevaux. */
function ShareLocked({ message }: { message: string }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-3xl">🔒</Text>
        <Text className="text-center text-xl font-bold text-text">Partage du cheval</Text>
        <Text className="text-center text-sm text-muted">{message}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/paywall")}
          className="rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-sm font-bold text-on-primary">Voir les offres</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-sm font-semibold text-muted">Retour</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function ShareHorseModal() {
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { horses } = useHorses();
  const { tier } = useSubscription();
  const horse = horses.find((h) => h.id === horseId);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("DEMI_PENSION");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => {
    if (!horseId) return;
    listCollaborators(horseId).then((list) => {
      setCollaborators(list);
      setLoaded(true);
    });
  }, [horseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (tier === "FREE") {
    return <ShareLocked message="Le partage avec une demi-pension ou un coach est réservé au pack Paddock et plus." />;
  }
  if (!horse) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-muted">Cheval introuvable.</Text>
      </SafeAreaView>
    );
  }

  const atLimit = collaborators.length >= 1;

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setSubmitting(true);
    try {
      const ok = await inviteCollaborator(horseId, trimmed, role);
      if (ok) {
        setEmail("");
        refresh();
      } else {
        // Cause la plus probable : cet email est déjà invité sur ce cheval
        // (contrainte unique horseId+invitedEmail) — pas une erreur réseau,
        // mais on ne peut pas distinguer les deux côté client sans détail
        // d'erreur structuré, donc message générique.
        Alert.alert(
          "Invitation impossible",
          "Cet email est peut-être déjà invité sur ce cheval, ou une erreur réseau est survenue. Réessaie."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeCollaborator(id);
    refresh();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="gap-5 px-5 pt-4 pb-8" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-extrabold tracking-tight text-text">Partager {horse.name}</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text className="text-xl text-muted">✕</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-sm text-muted">
          Connecte une demi-pension ou un coach pour qu&apos;il puisse lire et écrire dans le calendrier de ce
          cheval.
        </Text>

        {!loaded ? null : collaborators.length === 0 ? (
          <View className={`${CARD} items-center gap-1`}>
            <Text className="text-2xl">🤝</Text>
            <Text className="text-sm text-muted">Personne n&apos;est encore connecté à ce cheval.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {collaborators.map((c) => (
              <View key={c.id} className={`${CARD} flex-row items-center gap-3`}>
                <Text className="text-lg">{ROLE_META[c.role].icon}</Text>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-text">{c.invitedEmail}</Text>
                  <Text className="text-xs text-muted">
                    {ROLE_META[c.role].label} · {STATUS_META[c.status]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRevoke(c.id)} hitSlop={8}>
                  <Text className="text-sm font-semibold text-danger">Révoquer</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {atLimit ? (
          <View className={`${CARD} items-center gap-2`}>
            <Text className="text-sm text-muted">
              Limite d&apos;un·e collaborateur·rice par cheval atteinte — révoque l&apos;accès actuel pour en inviter
              un·e autre.
            </Text>
          </View>
        ) : (
          <View className={`${CARD} gap-3`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Inviter</Text>
            <Field label="Email">
              <TextInput
                className={INPUT}
                placeholder="email@exemple.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </Field>
            <Field label="Rôle">
              <View className="flex-row gap-2">
                {(Object.entries(ROLE_META) as [CollaboratorRole, { label: string; icon: string }][]).map(
                  ([value, meta]) => {
                    const selected = role === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setRole(value)}
                        activeOpacity={0.8}
                        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 ${
                          selected ? "border-primary bg-highlight" : "border-border bg-surface"
                        }`}
                      >
                        <Text className="text-sm">{meta.icon}</Text>
                        <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>
                          {meta.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </Field>
            <PrimaryButton
              label={submitting ? "Envoi…" : "Envoyer l'invitation"}
              disabled={submitting || !email.trim().includes("@")}
              onPress={handleInvite}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
