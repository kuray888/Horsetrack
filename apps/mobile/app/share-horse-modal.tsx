import { useCallback, useEffect, useState } from "react";
import { PRO_ENABLED } from "@/lib/features";
import { Alert, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/onboarding";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { collaboratorLimit } from "@/subscription/logic";
import { openPaywall } from "@/subscription/paywall";
import { markPremiumActivated } from "@/subscription/trialLifecycle";
import { track } from "@/lib/analytics";
import { hapticSelection } from "@/lib/haptics";
import { DOWNLOAD_URL } from "@/lib/links";
import { recordPositiveMoment } from "@/lib/reviewPrompt";
import { colors } from "@/theme/colors";
import {
  inviteCollaborator,
  listCollaborators,
  revokeCollaborator,
  COLLABORATOR_ROLES,
  ROLE_LABEL,
  ROLE_RIGHTS,
  type Collaborator,
  type CollaboratorRole,
} from "@/lib/sharing";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

const ROLE_ICON: Record<CollaboratorRole, keyof typeof MaterialCommunityIcons.glyphMap> = {
  DEMI_PENSION: "handshake-outline",
  COACH: "school-outline",
  RIDER: "account-outline",
  GROOM: "broom",
  MANAGER: "account-tie-outline",
  VET: "stethoscope",
  FARRIER: "anvil",
};
const ROLE_META: Record<CollaboratorRole, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  DEMI_PENSION: { label: ROLE_LABEL.DEMI_PENSION, icon: ROLE_ICON.DEMI_PENSION },
  COACH: { label: ROLE_LABEL.COACH, icon: ROLE_ICON.COACH },
  RIDER: { label: ROLE_LABEL.RIDER, icon: ROLE_ICON.RIDER },
  GROOM: { label: ROLE_LABEL.GROOM, icon: ROLE_ICON.GROOM },
  MANAGER: { label: ROLE_LABEL.MANAGER, icon: ROLE_ICON.MANAGER },
  VET: { label: ROLE_LABEL.VET, icon: ROLE_ICON.VET },
  FARRIER: { label: ROLE_LABEL.FARRIER, icon: ROLE_ICON.FARRIER },
};

const STATUS_META: Record<Collaborator["status"], string> = {
  PENDING: t("En attente"),
  ACCEPTED: t("Actif"),
};

/** Réservé aux comptes Premium, et 1 collaborateur par cheval (cf. grille
 * tarifaire) — même pattern d'upsell que add-horse-modal.tsx pour la limite
 * de chevaux. */
function ShareLocked({ horseId, horseName }: { horseId?: string; horseName?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name="lock-outline" size={28} color={colors.primary} />
        </View>
        <Text className="text-center text-xl font-bold text-text">{t("Partage ")}{horseName ?? t("ton cheval")} {t(" avec ta demi-pension")}</Text>
        <Text className="text-center text-sm text-muted">
          {t("Ta DP, ton coach ou ton groom retrouvent son planning, ses soins et ses rendez-vous. Disponible avec Premium.")}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openPaywall("sharing", { feature: "share_horse", horseId })}
          className="rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-sm font-bold text-on-primary">{t("Découvrir Premium")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-sm font-semibold text-muted">{t("Retour")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function ShareHorseModal() {
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { horses } = useHorses();
  const subscription = useSubscription();
  const { isActiveOrTrialing, isPro } = subscription;
  const horse = horses.find((h) => h.id === horseId);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("DEMI_PENSION");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => {
    if (!horseId) return;
    listCollaborators(horseId)
      .then((list) => {
        if (list) {
          setCollaborators(list);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
        setLoaded(true);
      })
      .catch((e) => {
        console.warn("[share-horse] listCollaborators échoué", e);
        setLoadError(true);
        setLoaded(true);
      });
  }, [horseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isActiveOrTrialing) {
    return <ShareLocked horseId={horseId} horseName={horse?.name} />;
  }
  if (!horse) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-muted">{t("Cheval introuvable.")}</Text>
      </SafeAreaView>
    );
  }

  // 1 personne en Premium, 5 en Écurie Pro (même règle que le serveur, cf.
  // rls.sql horse_collaborator_limit).
  const limit = collaboratorLimit(subscription);
  const atLimit = collaborators.length >= limit;

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setSubmitting(true);
    try {
      const result = await inviteCollaborator(horseId, trimmed, role);
      if (result === "ok") {
        track("share_invite_sent", { role });
        markPremiumActivated();
        recordPositiveMoment("invite_sent");
        setEmail("");
        // L'email part toujours (c'est lui qui rattache l'invitation au
        // compte), mais dans les écuries on se parle surtout par WhatsApp/SMS :
        // on propose d'y prévenir la personne, avec le lien et l'adresse à
        // utiliser — un email d'invitation se perd facilement.
        const message = [
          t("Je t'ai invité·e à suivre {v} sur Horsetrack 🐴", { v: horse?.name ?? "mon cheval" }),
          DOWNLOAD_URL ? t("Installe l'app : {DOWNLOAD_URL}", { DOWNLOAD_URL: DOWNLOAD_URL }) : t("Installe l'app Horsetrack"),
          t("puis crée ton compte avec {trimmed} : l'invitation s'affichera toute seule.", { trimmed: trimmed }),
        ].join("\n");
        Alert.alert(
          t("Invitation envoyée"),
          t("{trimmed} a reçu un email pour rejoindre {v}. Tu peux aussi la prévenir par message.", { trimmed: trimmed, v: horse?.name ?? "ce cheval" }),
          [
            { text: "OK", style: "cancel" },
            {
              text: t("Envoyer un message"),
              onPress: () => {
                track("share_invite_message_opened", { role });
                Share.share({ message }).catch(() => {});
              },
            },
          ]
        );
        refresh();
      } else if (result === "duplicate") {
        // Une invitation PENDING pour ce même email est renvoyée automatiquement
        // (nouveau rôle/nouvelle validité) plutôt que de finir ici (cf.
        // inviteCollaborator) — "duplicate" ne signifie donc plus qu'une chose :
        // cet email est déjà un·e collaborateur·rice ACCEPTED sur ce cheval.
        Alert.alert(t("Déjà collaborateur·rice"), t("Cette personne a déjà accepté un accès à ce cheval."));
      } else if (result === "quota") {
        Alert.alert(
          t("Limite atteinte"),
          t("Un·e collaborateur·rice est déjà connecté·e à ce cheval — révoque son accès pour en inviter un·e autre.")
        );
      } else if (result === "not_premium") {
        // Ce cas signifie que le serveur ne voit pas cet abonnement comme actif,
        // même si cet écran n'est accessible qu'aux comptes Premium côté app —
        // signe d'un abonnement pas encore synchronisé côté serveur plutôt que
        // d'un vrai bug de partage (cf. audit pré-publication : le partage
        // gratuit n'existe pas, l'écran ne serait pas accessible sinon).
        Alert.alert(
          t("Abonnement non reconnu par le serveur"),
          t("Ton abonnement Premium n'est pas encore confirmé côté serveur. Réessaie dans quelques minutes, ou restaure tes achats depuis Profil si le problème persiste.")
        );
      } else {
        Alert.alert(t("Invitation impossible"), t("Une erreur réseau est survenue. Réessaie."));
      }
    } catch {
      Alert.alert(t("Invitation impossible"), t("Une erreur est survenue. Réessaie."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(collaborator: Collaborator) {
    try {
      const revoked = await revokeCollaborator(horseId, collaborator);
      refresh();
      if (!revoked) Alert.alert(t("Erreur"), t("Impossible de retirer cette personne pour l'instant. Réessaie."));
    } catch {
      Alert.alert(t("Erreur"), t("Impossible de retirer cette personne pour l'instant. Réessaie."));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-4 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-display tracking-tight text-text">{t("Partager ")}{horse.name}</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
        <Text className="text-sm text-muted">
          {t("Connecte une demi-pension, un coach, une cavalière ou un groom pour qu'il·elle puisse lire et écrire sur le planning, les concours, le journal et le budget de ce cheval, et consulter sa fiche santé. Le coffre-fort de documents reste réservé au propriétaire.")}
        </Text>

        {!loaded ? null : loadError ? (
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="wifi-off" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-sm text-muted">{t("Impossible de charger les personnes partagées. Vérifie ta connexion.")}</Text>
            <TouchableOpacity onPress={refresh} hitSlop={8}>
              <Text className="text-sm font-semibold text-accent">{t("Réessayer")}</Text>
            </TouchableOpacity>
          </View>
        ) : collaborators.length === 0 ? (
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="handshake-outline" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-sm text-muted">{t("Personne n'est encore connecté à ce cheval.")}</Text>
          </View>
        ) : (
          <View className="gap-2">
            {collaborators.map((c) => (
              <View key={c.id} className={`${CARD} flex-row items-center gap-3`}>
                <MaterialCommunityIcons name={ROLE_META[c.role].icon} size={20} color={colors.accent} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-text">{c.invitedEmail}</Text>
                  <Text className="text-xs text-muted">
                    {ROLE_META[c.role].label} · {STATUS_META[c.status]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRevoke(c)} hitSlop={8}>
                  <Text className="text-sm font-semibold text-danger">{t("Révoquer")}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Plusieurs chevaux : toute l'équipe sur un écran, invitation
            multi-chevaux (cf. app/equipe.tsx). */}
        {horses.filter((h) => !h.sharedRole).length > 1 ? (
          <TouchableOpacity
            onPress={() => router.push("/equipe")}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-card bg-surface p-4"
          >
            <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.primary} />
            <Text className="flex-1 text-sm font-semibold text-text">{t("Gérer l'équipe de tous tes chevaux")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {loadError ? null : atLimit ? (
          <View className={`${CARD} items-center gap-3`}>
            <Text className="text-center text-sm text-muted">
              {isPro
                ? t("Limite de 5 personnes par cheval atteinte — révoque un accès pour en inviter une autre.")
                : t("Limite d'un·e collaborateur·rice par cheval atteinte — révoque l'accès actuel pour en inviter un·e autre.")}
            </Text>
            {isPro || !PRO_ENABLED ? null : (
              <TouchableOpacity
                onPress={() => {
                  track("locked_feature_tapped", { feature: "collaborator_limit", placement: "pro" });
                  router.push("/pro");
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                testID="share-pro"
                className="w-full items-center rounded-card bg-primary p-3"
              >
                <Text className="text-sm font-bold text-on-primary">{t("Jusqu'à 5 personnes avec Écurie Pro")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className={`${CARD} gap-3`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">{t("Inviter")}</Text>
            <Field label={t("Email")}>
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
            <Field label={t("Rôle")}>
              <View className="flex-row flex-wrap gap-2">
                {COLLABORATOR_ROLES.map((value) => {
                  const meta = ROLE_META[value];
                  const selected = role === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => {
                        hapticSelection();
                        setRole(value);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={meta.label}
                      className={`w-[48%] flex-row items-center justify-center gap-2 rounded-full border px-4 py-2 ${
                        selected ? "border-primary bg-highlight" : "border-border bg-surface"
                      }`}
                    >
                      <MaterialCommunityIcons name={meta.icon} size={15} color={selected ? colors.primary : colors.textMuted} />
                      <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="mt-2 text-sm text-muted">{ROLE_RIGHTS[role]}</Text>
            </Field>
            <PrimaryButton
              label={submitting ? "Envoi…" : t("Envoyer l'invitation")}
              disabled={submitting || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
              onPress={handleInvite}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
