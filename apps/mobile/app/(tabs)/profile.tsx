import { useEffect, useState } from "react";
import { Alert, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import type { User } from "@supabase/supabase-js";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useSubscription } from "@/subscription/store";
import { useThemeColors, useTheme } from "@/theme/ThemeProvider";
import { THEME_ORDER, THEME_LABELS, PALETTES } from "@/theme/palettes";
import {
  isBiometricsAvailable,
  authenticateWithBiometrics,
  getBiometricType,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from "@/lib/biometrics";
import { cancelWeeklySummary, ensureNotificationPermission, getNotificationStatus } from "@/lib/notifications";
import { deleteAccount } from "@/lib/account";
import { clearLocalDataOwner } from "@/lib/deviceOwner";
import { resetOnboardingCompleted } from "@/onboarding/completion";
import { formatDate } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useAgenda } from "@/agenda/store";
import { useGoals } from "@/goals/store";
import { DISCIPLINES, RIDER_LEVELS, RIDER_GOALS, RIDE_FREQUENCIES } from "@/onboarding/options";

const CARD = "rounded-card bg-surface p-5 shadow-card";

function labelOf<T extends string>(options: { value: T; label: string }[], value: T | null): string {
  if (value === null) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

function daysUntil(dateIso: string | null): number {
  if (!dateIso) return 0;
  return Math.max(0, Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="text-xl font-display-bold text-text">{children}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-semibold text-text">{value}</Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-highlight">
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-text">{label}</Text>
        {description ? <Text className="text-xs text-muted">{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { themeId, setThemeId } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const subscription = useSubscription();
  const {
    status,
    billingPeriod,
    trialEndsAt,
    isActiveOrTrialing,
    loading: subLoading,
    clearAll: clearSubscription,
  } = subscription;
  const { horses, clearAll: clearHorses } = useHorses();
  const { riderProfile, clearAll: clearRiderProfile } = useRiderProfile();
  const { clearAll: clearAgenda } = useAgenda();
  const { goals, clearAll: clearGoals } = useGoals();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biométrie");
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    getNotificationStatus().then(setNotifEnabled);
    isBiometricsAvailable().then(setBioAvailable);
    getBiometricType().then((t) => setBioLabel(t === "face" ? "Face ID" : t === "fingerprint" ? "Empreinte digitale" : "Biométrie"));
    isBiometricLockEnabled().then(setBioEnabled);
  }, []);

  async function handleToggleNotif(next: boolean) {
    if (!next) return; // impossible de révoquer la permission depuis l'app, seulement via Réglages
    const granted = await ensureNotificationPermission();
    setNotifEnabled(granted);
  }

  async function handleToggleBiometrics(next: boolean) {
    if (next) {
      const ok = await authenticateWithBiometrics("Active le verrouillage biométrique de Horsetrack");
      if (!ok) return;
    }
    await setBiometricLockEnabled(next);
    setBioEnabled(next);
  }

  async function signOut() {
    await cancelWeeklySummary();
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Supprimer ton compte ?",
      "Toutes tes données (profil, chevaux, séances, rendez-vous, documents) seront définitivement supprimées. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: confirmDeleteAccount },
      ]
    );
  }

  async function confirmDeleteAccount() {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      // Le compte n'existe déjà plus côté serveur à ce stade : on ne demande
      // qu'une déconnexion locale (scope "local") pour ne pas dépendre d'un
      // appel réseau qui viserait un utilisateur déjà supprimé.
      await supabase.auth.signOut({ scope: "local" });
      // Vide tous les caches locaux pour repartir d'un état "installation
      // fraîche" — sinon le prochain compte créé sur cet appareil hériterait
      // de l'écurie, de la progression, de l'agenda ou de l'abo de l'ancien.
      await Promise.all([
        cancelWeeklySummary(),
        resetOnboardingCompleted(),
        clearHorses(),
        clearRiderProfile(),
        clearAgenda(),
        clearGoals(),
        clearSubscription(),
        clearLocalDataOwner(),
      ]);
      router.replace("/(onboarding)/welcome");
    } catch (e) {
      Alert.alert("Oups", e instanceof Error ? e.message : "Impossible de supprimer le compte pour l'instant.");
    } finally {
      setDeletingAccount(false);
    }
  }

  function subscriptionLabel(): string {
    if (subLoading) return "Chargement…";
    if (status === "active") return `Premium · ${billingPeriod === "ANNUAL" ? "annuel" : "mensuel"}`;
    if (status === "trialing") {
      const days = daysUntil(trialEndsAt);
      return `Essai Premium · ${days} jour${days !== 1 ? "s" : ""} restant${days !== 1 ? "s" : ""}`;
    }
    return "Palier gratuit";
  }

  return (
    <Screen>
      {/* En-tête */}
      <FadeInView>
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
            <Text className="text-2xl font-display text-primary">
              {(user?.email ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-2xl font-display tracking-tight text-text">Mon profil</Text>
            <Text className="text-sm text-muted">{user?.email ?? "Non connecté"}</Text>
          </View>
        </View>
      </FadeInView>

      {/* Abonnement — teinté quand Premium est actif, pour que le statut se
          voie d'un coup d'œil plutôt que de se lire dans une carte neutre. */}
      <FadeInView delay={60}>
        <View
          className={`flex-row items-center gap-3 rounded-card p-5 shadow-card ${
            isActiveOrTrialing ? "bg-primary" : "bg-surface"
          }`}
        >
          <View className={`h-10 w-10 items-center justify-center rounded-full ${isActiveOrTrialing ? "bg-on-primary/15" : "bg-highlight"}`}>
            <MaterialCommunityIcons
              name={isActiveOrTrialing ? "star-outline" : "star-off-outline"}
              size={20}
              color={isActiveOrTrialing ? colors.textOnPrimary : colors.primary}
            />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className={`text-base font-display-bold ${isActiveOrTrialing ? "text-on-primary" : "text-text"}`}>
              {subscriptionLabel()}
            </Text>
            <Text className={`text-xs ${isActiveOrTrialing ? "text-on-primary/80" : "text-muted"}`}>
              {isActiveOrTrialing
                ? "Profite de toutes les fonctionnalités Premium"
                : "1 cheval, planning et agenda gratuits — passe à Premium pour plus"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.8}>
            <Text className={`text-sm font-bold ${isActiveOrTrialing ? "text-on-primary" : "text-accent"}`}>
              {isActiveOrTrialing ? "Gérer" : "Voir Premium"}
            </Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      {/* Profil cavalier */}
      <FadeInView delay={260}>
        <View className="flex-row items-center justify-between">
          <SectionTitle>Mon profil cavalier</SectionTitle>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/edit-rider-modal")}>
            <Text className="text-sm font-semibold text-accent">Modifier</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={300}>
        <View className={CARD}>
          <InfoRow label="Niveau" value={labelOf(RIDER_LEVELS, riderProfile.level)} />
          <InfoRow label="Discipline principale" value={labelOf(DISCIPLINES, riderProfile.mainDiscipline)} />
          <InfoRow label="Fréquence de monte" value={labelOf(RIDE_FREQUENCIES, riderProfile.rideFrequency)} />
          <InfoRow label="Objectif principal" value={labelOf(RIDER_GOALS, riderProfile.primaryGoal)} />
        </View>
      </FadeInView>

      {/* Mes objectifs */}
      <FadeInView delay={330}>
        <SectionTitle>Mes objectifs</SectionTitle>
      </FadeInView>

      <FadeInView delay={360}>
        <View className="gap-3">
          {goals.length === 0 ? (
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="flag-outline" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-sm text-muted">Aucun objectif pour l&apos;instant.</Text>
            </View>
          ) : (
            goals
              .slice()
              .sort((a, b) => (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity))
              .map((goal) => {
                const horseName = goal.horseId ? horses.find((h) => h.id === goal.horseId)?.name : null;
                const icon = goal.type ? RIDER_GOALS.find((g) => g.value === goal.type)?.icon : null;
                const subtitle = [goal.targetDate ? formatDate(goal.targetDate) : null, horseName]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <TouchableOpacity
                    key={goal.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/goal-modal?id=${goal.id}`)}
                    className={`${CARD} flex-row items-center gap-3`}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                      <MaterialCommunityIcons name={icon?.name ?? "flag-outline"} size={18} color={icon?.color ?? colors.primary} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-base font-bold text-text">{goal.title}</Text>
                      {subtitle ? <Text className="text-sm text-muted">{subtitle}</Text> : null}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/goal-modal")}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">Ajouter un objectif</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      {/* Apparence */}
      <FadeInView delay={400}>
        <SectionTitle>Apparence</SectionTitle>
      </FadeInView>

      <FadeInView delay={410}>
        <View className={`${CARD} gap-3`}>
          <Text className="text-sm text-muted">Choisis la palette de couleur de l&apos;app.</Text>
          <View className="flex-row flex-wrap gap-3">
            {THEME_ORDER.map((id) => {
              const selected = id === themeId;
              const swatch = PALETTES[id];
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setThemeId(id)}
                  activeOpacity={0.8}
                  accessibilityLabel={THEME_LABELS[id]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="w-[30%] items-center gap-1.5"
                >
                  <View
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: swatch.primary,
                      borderWidth: selected ? 3 : 0,
                      borderColor: colors.text,
                    }}
                  >
                    {selected ? <MaterialCommunityIcons name="check" size={18} color={swatch.textOnPrimary} /> : null}
                  </View>
                  <Text className={`text-xs font-semibold ${selected ? "text-text" : "text-muted"}`}>
                    {THEME_LABELS[id]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </FadeInView>

      {/* Réglages */}
      <FadeInView delay={420}>
        <SectionTitle>Réglages</SectionTitle>
      </FadeInView>

      <FadeInView delay={460}>
        <View className={CARD}>
          <SettingRow
            icon="bell-outline"
            label="Notifications"
            description={notifEnabled ? "Activées dans les réglages système" : "Pour les rappels de rendez-vous"}
            value={notifEnabled}
            disabled={notifEnabled}
            onValueChange={handleToggleNotif}
          />
          <View className="border-t border-border" />
          <SettingRow
            icon="shield-lock-outline"
            label={`Verrouillage ${bioLabel}`}
            description={
              bioAvailable
                ? "Demande une vérification à l'ouverture de l'app"
                : "Indisponible sur cet appareil"
            }
            value={bioEnabled}
            disabled={!bioAvailable}
            onValueChange={handleToggleBiometrics}
          />
        </View>
      </FadeInView>

      {/* Compte */}
      <FadeInView delay={500}>
        <SectionTitle>Compte</SectionTitle>
      </FadeInView>

      <FadeInView delay={540}>
        <View className="gap-3">
          <TouchableOpacity
            className="items-center rounded-card border border-border bg-surface p-4"
            onPress={() => router.push("/change-password-modal")}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-text">Changer le mot de passe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center rounded-card border border-border bg-surface p-4"
            onPress={signOut}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-text">Se déconnecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center rounded-card border border-danger/30 p-4"
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-danger">
              {deletingAccount ? "Suppression…" : "Supprimer mon compte"}
            </Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={580}>
        <Text className="pt-2 text-center text-xs text-muted">Horsetrack · v{Constants.expoConfig?.version ?? "—"}</Text>
      </FadeInView>
    </Screen>
  );
}
