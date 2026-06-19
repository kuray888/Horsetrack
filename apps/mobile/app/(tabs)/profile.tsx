import { useEffect, useState } from "react";
import { Alert, Image, Switch, Text, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useSubscription } from "@/subscription/store";
import { colors } from "@/theme/colors";
import { isBiometricsAvailable, authenticateWithBiometrics, getBiometricType } from "@/lib/biometrics";
import { ensureNotificationPermission, getNotificationStatus } from "@/lib/notifications";
import { pickAndPersistImage } from "@/lib/imagePicker";
import { useProgress } from "@/progress/store";
import { useHorses } from "@/horses/store";
import { BADGES } from "@/program/badges";
import {
  DISCIPLINES,
  RIDER_LEVELS,
  RIDER_GOALS,
  RIDE_FREQUENCIES,
  HORSE_LEVELS,
} from "@/onboarding/options";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency } from "@/onboarding/store";

// --- Profil cavalier mock (à brancher sur l'onboarding persisté plus tard) ---
const riderProfile = {
  level: "AMATEUR" as RiderLevel,
  mainDiscipline: "SHOW_JUMPING" as Discipline,
  rideFrequency: "SEVERAL_PER_WEEK" as RideFrequency,
  primaryGoal: "COMPETE" as RiderGoal,
};

const BIOMETRICS_KEY = "biometric_lock_enabled_v1";
const CARD = "rounded-card bg-surface p-5 shadow-card";

function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function daysUntil(dateIso: string | null): number {
  if (!dateIso) return 0;
  return Math.max(0, Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="text-xl font-bold text-text">{children}</Text>;
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
  icon: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Text className="text-xl">{icon}</Text>
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
  const [user, setUser] = useState<User | null>(null);
  const { status, plan, trialEndsAt, isPremium, loading: subLoading } = useSubscription();
  const { unlockedBadges } = useProgress();
  const { horses, updateHorsePhoto } = useHorses();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biométrie");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    getNotificationStatus().then(setNotifEnabled);
    isBiometricsAvailable().then(setBioAvailable);
    getBiometricType().then((t) => setBioLabel(t === "face" ? "Face ID" : t === "fingerprint" ? "Empreinte digitale" : "Biométrie"));
    SecureStore.getItemAsync(BIOMETRICS_KEY).then((v) => setBioEnabled(v === "true"));
  }, []);

  async function handleToggleNotif(next: boolean) {
    if (!next) return; // impossible de révoquer la permission depuis l'app, seulement via Réglages
    const granted = await ensureNotificationPermission();
    setNotifEnabled(granted);
  }

  async function handleToggleBiometrics(next: boolean) {
    if (next) {
      const ok = await authenticateWithBiometrics("Active le verrouillage biométrique de Cheval");
      if (!ok) return;
    }
    await SecureStore.setItemAsync(BIOMETRICS_KEY, String(next));
    setBioEnabled(next);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Bientôt disponible",
      "La suppression de compte n'est pas encore disponible. Contacte le support si besoin.",
    );
  }

  function subscriptionLabel(): string {
    if (subLoading) return "Chargement…";
    if (status === "active") return `Abonnement ${plan === "ANNUAL" ? "annuel" : "mensuel"} actif`;
    if (status === "trialing") {
      const days = daysUntil(trialEndsAt);
      return `Essai gratuit · ${days} jour${days !== 1 ? "s" : ""} restant${days !== 1 ? "s" : ""}`;
    }
    return "Aucun abonnement actif";
  }

  const primaryHorse = horses.find((h) => h.isPrimary) ?? horses[0];

  return (
    <Screen>
      {/* En-tête */}
      <FadeInView>
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
            <Text className="text-2xl font-extrabold text-primary">
              {(user?.email ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-2xl font-extrabold tracking-tight text-text">Mon profil</Text>
            <Text className="text-sm text-muted">{user?.email ?? "Non connecté"}</Text>
          </View>
        </View>
      </FadeInView>

      {/* Abonnement */}
      <FadeInView delay={60}>
        <View className={`${CARD} flex-row items-center gap-3`}>
          <Text className="text-2xl">{isPremium ? "⭐" : "🔓"}</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-bold text-text">{subscriptionLabel()}</Text>
            <Text className="text-xs text-muted">
              {isPremium ? "Profite de toutes les fonctionnalités" : "Débloque le suivi complet"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.8}>
            <Text className="text-sm font-bold text-accent">{isPremium ? "Gérer" : "Voir les offres"}</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      {/* Mon écurie */}
      <FadeInView delay={120}>
        <SectionTitle>Mon écurie</SectionTitle>
      </FadeInView>

      {horses.map((horse, i) => (
        <FadeInView key={horse.id} delay={160 + i * 60}>
          <View className={`${CARD} flex-row items-center gap-3`}>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickAndPersistImage();
                if (uri) updateHorsePhoto(horse.id, uri);
              }}
              activeOpacity={0.8}
              className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-highlight"
            >
              {horse.photoUrl ? (
                <Image source={{ uri: horse.photoUrl }} className="h-12 w-12" />
              ) : (
                <Text className="text-2xl">{horse.emoji}</Text>
              )}
            </TouchableOpacity>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-text">
                {horse.name}
                {horse.isPrimary ? "  ⭐" : ""}
              </Text>
              <Text className="text-sm text-muted">
                {labelOf(DISCIPLINES, horse.discipline)} · {labelOf(HORSE_LEVELS, horse.level)}
              </Text>
              {horse.strengths.length > 0 ? (
                <Text className="text-xs text-success">💪 {horse.strengths.join(", ")}</Text>
              ) : null}
            </View>
          </View>
        </FadeInView>
      ))}

      <FadeInView delay={220}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/add-horse-modal")}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
        >
          <Text className="text-lg font-bold text-primary">＋</Text>
          <Text className="text-base font-semibold text-primary">Ajouter un cheval</Text>
        </TouchableOpacity>
      </FadeInView>

      {/* Profil cavalier */}
      <FadeInView delay={260}>
        <View className="flex-row items-center justify-between">
          <SectionTitle>Mon profil cavalier</SectionTitle>
          <TouchableOpacity activeOpacity={0.7}>
            <Text className="text-sm font-semibold text-accent">Modifier (bientôt)</Text>
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

      {/* Mes succès */}
      <FadeInView delay={340}>
        <View className="flex-row items-center justify-between">
          <SectionTitle>Mes succès</SectionTitle>
          <Text className="text-sm text-muted">
            {unlockedBadges.length}/{BADGES.length}
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={380}>
        <View className="flex-row flex-wrap gap-3">
          {BADGES.map((badge) => {
            const unlocked = unlockedBadges.some((b) => b.id === badge.id);
            return (
              <View key={badge.id} className={`${CARD} w-[47%] items-center gap-1.5`}>
                <View
                  className={`h-14 w-14 items-center justify-center rounded-full ${
                    unlocked ? "bg-highlight" : "bg-border"
                  }`}
                >
                  <Text className={`text-2xl ${unlocked ? "" : "opacity-30"}`}>{badge.icon}</Text>
                </View>
                <Text className={`text-center text-xs font-bold ${unlocked ? "text-text" : "text-muted"}`}>
                  {badge.label}
                </Text>
                <Text className="text-center text-[11px] leading-4 text-muted">{badge.description}</Text>
              </View>
            );
          })}
        </View>
      </FadeInView>

      {/* Réglages */}
      <FadeInView delay={420}>
        <SectionTitle>Réglages</SectionTitle>
      </FadeInView>

      <FadeInView delay={460}>
        <View className={CARD}>
          <SettingRow
            icon="🔔"
            label="Notifications"
            description={notifEnabled ? "Activées dans les réglages système" : "Pour les rappels de rendez-vous"}
            value={notifEnabled}
            disabled={notifEnabled}
            onValueChange={handleToggleNotif}
          />
          <View className="border-t border-border" />
          <SettingRow
            icon="🔐"
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
            onPress={signOut}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-text">Se déconnecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center rounded-card border border-danger/30 p-4"
            onPress={handleDeleteAccount}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-danger">Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={580}>
        <Text className="pt-2 text-center text-xs text-muted">Cheval · v1.0.0</Text>
      </FadeInView>
    </Screen>
  );
}
