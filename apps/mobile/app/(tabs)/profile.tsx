import { useEffect, useState } from "react";
import { clearExtras } from "@/extras/store";
import { Alert, Linking, Platform, Share, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import type { User } from "@supabase/supabase-js";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { supabase } from "@/lib/supabase";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { unregisterPushToken } from "@/lib/pushRegistration";
import { formatFullDate } from "@/subscription/paywallLogic";
import { openManageSubscriptions } from "@/lib/revenuecat";
import { track } from "@/lib/analytics";
import { DOWNLOAD_URL, SUPPORT_EMAIL, canOpenWriteReview, openSupportEmail, openWriteReview } from "@/lib/links";
import { useThemeColors, useTheme } from "@/theme/ThemeProvider";
import { THEME_ORDER, THEME_LABELS, paletteFor } from "@/theme/palettes";
import {
  isBiometricsAvailable,
  authenticateWithBiometrics,
  getBiometricType,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from "@/lib/biometrics";
import { cancelWeeklySummary, ensureNotificationPermission, getNotificationStatus } from "@/lib/notifications";
import { getSessionRemindersEnabled, setSessionRemindersEnabled } from "@/sessions/SessionReminders";
import { AccountError, deleteAccount } from "@/lib/account";
import { getAppleAuthorizationCode } from "@/lib/appleAuth";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { purgeAccountMediaFiles } from "@/lib/localMedia";
import { clearLocalDataOwner } from "@/lib/deviceOwner";
import { resetOnboardingCompleted } from "@/onboarding/completion";
import { formatDate } from "@/lib/dateFormat";
import { startupTrace, formatTrace, summarizeTrace } from "@/lib/startupTrace";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useAgenda } from "@/agenda/store";
import { useGoals } from "@/goals/store";
import { useWeight } from "@/horses/weightStore";
import { useSessions } from "@/sessions/store";
import { clearSyncQueue } from "@/lib/syncQueue";
import { DISCIPLINES, RIDER_LEVELS, RIDER_GOALS, RIDE_FREQUENCIES } from "@/onboarding/options";
import { lazyTab } from "@/components/LazyTab";
import { exportAllData } from "@/export/exportAllData";
import { t as tr } from "@/i18n";

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

/** Ligne cliquable, même gabarit que SettingRow (icône, libellé, description). */
function LinkRow({
  icon,
  label,
  description,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center gap-3 py-3" accessibilityRole="button">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-highlight">
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-text">{label}</Text>
        {description ? <Text className="text-xs text-muted">{description}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function ProfileScreen() {
  const colors = useThemeColors();
  const { themeId, setThemeId, scheme, appearance, setAppearance } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const subscription = useSubscription();
  const {
    status,
    billingPeriod,
    trialEndsAt,
    promotional,
    isActiveOrTrialing,
    loading: subLoading,
    clearAll: clearSubscription,
  } = subscription;
  const { horses, clearAll: clearHorses } = useHorses();
  const { riderProfile, clearAll: clearRiderProfile } = useRiderProfile();
  const { appointments, journal, expenses, documents, clearAll: clearAgenda } = useAgenda();
  const { goals, clearAll: clearGoals } = useGoals();
  const { measurements, clearAll: clearWeight } = useWeight();
  const { sessions, clearAll: clearSessions } = useSessions();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportAllData({ horses, sessions, appointments, journal, expenses, weights: measurements, documents, goals });
    } finally {
      setExporting(false);
    }
  };

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [sessionRemindersOn, setSessionRemindersOn] = useState(true);
  const [bioLabel, setBioLabel] = useState(tr("Biométrie"));
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user)).catch(() => {});
    getNotificationStatus().then(setNotifEnabled).catch(() => {});
    isBiometricsAvailable().then(setBioAvailable).catch(() => {});
    getBiometricType()
      .then((t) => setBioLabel(t === "face" ? tr("Face ID") : t === "fingerprint" ? tr("Empreinte digitale") : tr("Biométrie")))
      .catch(() => {});
    isBiometricLockEnabled().then(setBioEnabled).catch(() => {});
    getSessionRemindersEnabled().then(setSessionRemindersOn).catch(() => {});
  }, []);

  async function handleToggleNotif(next: boolean) {
    if (!next) return; // impossible de révoquer la permission depuis l'app, seulement via Réglages
    try {
      const granted = await ensureNotificationPermission();
      setNotifEnabled(granted);
      // Refus déjà enregistré : l'OS ne réaffiche plus sa demande, et
      // l'interrupteur revenait sur « off » sans explication.
      if (!granted) {
        Alert.alert(
          tr("Notifications désactivées"),
          tr("Active-les dans les réglages de ton téléphone pour recevoir tes rappels et ton bilan du dimanche."),
          [
            { text: tr("Plus tard"), style: "cancel" },
            { text: tr("Ouvrir les réglages"), onPress: () => Linking.openSettings().catch(() => {}) },
          ]
        );
      }
    } catch {
      // Best-effort : cf. audit crash SecureStore/modules natifs du 2026-09-08.
    }
  }

  async function handleToggleBiometrics(next: boolean) {
    try {
      if (next) {
        const ok = await authenticateWithBiometrics(tr("Active le verrouillage biométrique de Horsetrack"));
        if (!ok) return;
      }
      await setBiometricLockEnabled(next);
      setBioEnabled(next);
    } catch {
      // Best-effort : cf. audit crash SecureStore/modules natifs du 2026-09-08.
    }
  }

  async function signOut() {
    try {
      await cancelWeeklySummary();
      await unregisterPushToken().catch(() => {});
      await supabase.auth.signOut();
    } catch {
      // Best-effort : on déconnecte quand même localement plutôt que de
      // bloquer l'utilisateur sur un échec réseau (cf. audit du 2026-09-08).
    } finally {
      router.replace("/(auth)/login");
    }
  }

  function handleDeleteAccount() {
    // Supprimer le compte n'arrête PAS l'abonnement : il est facturé par
    // Apple/Google, pas par nous. Sans ce rappel, un abonné qui supprime son
    // compte continuait d'être prélevé sans plus avoir accès à rien.
    const storeSubscription = storeManaged && status !== "trialing" ? tr("ton abonnement") : storeManaged ? tr("ton essai") : null;
    Alert.alert(
      tr("Supprimer ton compte ?"),
      [
        tr("Toutes tes données (profil, chevaux, séances, rendez-vous, documents) seront définitivement supprimées. Cette action est irréversible."),
        storeSubscription
          ? tr("\nImportant : supprimer ton compte n'arrête pas {storeSubscription}. Pour ne plus être prélevé, résilie-le d'abord dans {v}.", { storeSubscription: storeSubscription, v: Platform.OS === "ios" ? "Réglages > Abonnements" : "Google Play > Abonnements" })
          : "",
      ].join(""),
      [
        { text: tr("Annuler"), style: "cancel" },
        ...(storeSubscription
          ? [{ text: tr("Gérer l'abonnement"), onPress: () => void openManageSubscriptions() }]
          : []),
        { text: tr("Supprimer"), style: "destructive" as const, onPress: confirmDeleteAccount },
      ]
    );
  }

  /** Ramène l'appareil à un état « installation fraîche » une fois les données
   * du compte effacées côté serveur. */
  async function wipeLocalAccountData() {
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
      clearWeight(),
      clearExtras(),
      // Les séances manquaient à cet appel — alors que la confirmation
      // ci-dessus les nomme explicitement parmi ce qui « sera définitivement
      // supprimé ». Elles survivaient donc à la suppression du compte et
      // étaient héritées par le compte suivant créé sur cet appareil, qui les
      // repoussait ensuite dans SON cloud (cf. audit du 2026-09-23).
      clearSessions(),
      clearSubscription(),
      // Idem pour les écritures restées en attente : elles visent des lignes
      // d'un compte qui n'existe plus, et n'ont aucune raison de partir sous
      // l'identité du prochain. Même geste qu'au changement de compte (cf.
      // (auth)/login.tsx).
      clearSyncQueue(),
      clearLocalDataOwner(),
    ]);
    // Photos et pièces du coffre-fort copiées sur l'appareil : les listes
    // ci-dessus ne les référencent plus, elles restaient pourtant sur le
    // téléphone (cf. lib/localMedia.ts).
    purgeAccountMediaFiles();
    router.replace("/(onboarding)/welcome");
  }

  async function confirmDeleteAccount() {
    setDeletingAccount(true);
    try {
      // Compte « Se connecter avec Apple » : Apple exige qu'on révoque son
      // autorisation à la suppression (cf. lib/appleAuth.ts). Refus ou échec
      // de la feuille Apple : on supprime quand même.
      const signedInWithApple =
        user?.app_metadata?.provider === "apple" || !!user?.identities?.some((i) => i.provider === "apple");
      const appleAuthorizationCode = signedInWithApple
        ? await runNativeInteraction(getAppleAuthorizationCode).catch(() => null)
        : null;
      await deleteAccount({ appleAuthorizationCode });
      await wipeLocalAccountData();
    } catch (e) {
      console.error("[profile:deleteAccount]", e);
      // Données déjà effacées côté serveur, seule la fermeture du compte a
      // échoué : garder le cache local montrerait une écurie et un
      // coffre-fort qui n'existent plus nulle part, et que plus rien ne
      // pourrait sauvegarder (cf. audit du 2026-09-30).
      if (e instanceof AccountError && e.dataDeleted) {
        await wipeLocalAccountData().catch(() => {});
      }
      Alert.alert(tr("Oups"), e instanceof Error ? e.message : tr("Impossible de supprimer le compte pour l'instant."));
    } finally {
      setDeletingAccount(false);
    }
  }

  // Premium offert (ambassadeurs) : pas d'abonnement store derrière — ni
  // « Gérer », ni paywall, ni avertissement de résiliation.
  const storeManaged = isActiveOrTrialing && !promotional && (status === "active" || billingPeriod !== null);

  function subscriptionLabel(): string {
    if (subLoading) return "Chargement…";
    if (promotional && isActiveOrTrialing) return tr("Premium offert");
    if (status === "active") return tr("Premium · {v}", { v: billingPeriod === "ANNUAL" ? "annuel" : "mensuel" });
    if (status === "trialing") {
      const days = daysUntil(trialEndsAt);
      return tr("Essai Premium · {days} jour{v} restant{v2}", { days: days, v: days !== 1 ? "s" : "", v2: days !== 1 ? "s" : "" });
    }
    return tr("Palier gratuit");
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
            <Text className="text-2xl font-display tracking-tight text-text">{tr("Mon profil")}</Text>
            <Text className="text-sm text-muted">{user?.email ?? tr("Non connecté")}</Text>
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
              {isActiveOrTrialing && status === "trialing" && trialEndsAt
                ? tr("Fin de l'essai le {formatFullDate}", { formatFullDate: formatFullDate(new Date(trialEndsAt)) })
                : isActiveOrTrialing && promotional
                  ? tr("Offert par Horsetrack — aucun paiement")
                  : isActiveOrTrialing
                  ? tr("Profite de toutes les fonctionnalités Premium")
                  : tr("1 cheval, planning et agenda gratuits — passe à Premium pour plus")}
            </Text>
          </View>
          {/* Toujours le paywall : on y voit les formules et c'est le choix
              d'une formule qui ouvre la feuille d'achat du store (changement
              mensuel ↔ annuel compris). Ouvrir directement la gestion du store
              depuis ici n'incitait à rien (retour produit du 2026-09-26) ; la
              résiliation se fait dans Réglages > Abonnements, comme partout. */}
          {/* Premium offert : aucun bouton — le paywall proposerait d'acheter
              ce qu'elle a déjà gratuitement (risque de prélèvement inutile). */}
          {promotional && isActiveOrTrialing ? null : (
          <TouchableOpacity
            onPress={() => {
              if (storeManaged) track("manage_subscription_opened", { status });
              openPaywall(isActiveOrTrialing && status === "trialing" ? "trial_ending" : "profile");
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            testID="profile-premium"
          >
            <Text className={`text-sm font-bold ${isActiveOrTrialing ? "text-on-primary" : "text-accent"}`}>
              {storeManaged ? tr("Gérer") : isActiveOrTrialing ? tr("Garder Premium") : tr("Voir Premium")}
            </Text>
          </TouchableOpacity>
          )}
        </View>
      </FadeInView>

      {/* Profil cavalier */}
      <FadeInView delay={260}>
        <View className="flex-row items-center justify-between">
          <SectionTitle>{tr("Mon profil cavalier")}</SectionTitle>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/edit-rider-modal")}>
            <Text className="text-sm font-semibold text-accent">{tr("Modifier")}</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={300}>
        <View className={CARD}>
          <InfoRow label={tr("Niveau")} value={labelOf(RIDER_LEVELS, riderProfile.level)} />
          <InfoRow label={tr("Discipline principale")} value={labelOf(DISCIPLINES, riderProfile.mainDiscipline)} />
          {/* Plus demandés à l'inscription : affichés une fois renseignés
              (bouton « Modifier » ci-dessus). */}
          {riderProfile.rideFrequency ? (
            <InfoRow label={tr("Fréquence de monte")} value={labelOf(RIDE_FREQUENCIES, riderProfile.rideFrequency)} />
          ) : null}
          {riderProfile.primaryGoal ? (
            <InfoRow label={tr("Objectif principal")} value={labelOf(RIDER_GOALS, riderProfile.primaryGoal)} />
          ) : null}
        </View>
      </FadeInView>

      {/* Mes objectifs */}
      <FadeInView delay={330}>
        <SectionTitle>{tr("Mes objectifs")}</SectionTitle>
      </FadeInView>

      <FadeInView delay={360}>
        <View className="gap-3">
          {goals.length === 0 ? (
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="flag-outline" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-sm text-muted">{tr("Aucun objectif pour l'instant.")}</Text>
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
            <Text className="text-base font-semibold text-primary">{tr("Ajouter un objectif")}</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      {/* Apparence */}
      <FadeInView delay={400}>
        <SectionTitle>{tr("Apparence")}</SectionTitle>
      </FadeInView>

      <FadeInView delay={410}>
        <View className={`${CARD} gap-3`}>
          {/* Mode clair / sombre. « Automatique » suit le réglage de l'iPhone,
              y compris son passage en sombre le soir. */}
          <View className="flex-row gap-1 rounded-full bg-background p-1">
            {(
              [
                { value: "system", label: tr("Automatique") },
                { value: "light", label: tr("Clair") },
                { value: "dark", label: tr("Sombre") },
              ] as const
            ).map((opt) => {
              const selected = appearance === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setAppearance(opt.value)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-full py-2 ${selected ? "bg-primary" : ""}`}
                >
                  <Text className={`text-sm font-semibold ${selected ? "text-on-primary" : "text-muted"}`}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className="text-sm text-muted">{tr("Choisis la palette de couleur de l'app.")}</Text>
          <View className="flex-row flex-wrap gap-3">
            {THEME_ORDER.map((id) => {
              const selected = id === themeId;
              const swatch = paletteFor(id, scheme);
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
        <SectionTitle>{tr("Réglages")}</SectionTitle>
      </FadeInView>

      <FadeInView delay={460}>
        <View className={CARD}>
          <SettingRow
            icon="bell-outline"
            label={tr("Notifications")}
            description={notifEnabled ? tr("Activées dans les réglages système") : tr("Pour les rappels de rendez-vous")}
            value={notifEnabled}
            disabled={notifEnabled}
            onValueChange={handleToggleNotif}
          />
          <View className="border-t border-border" />
          <SettingRow
            icon="calendar-clock"
            label={tr("Rappels de séance")}
            description={
              notifEnabled
                ? tr("1 h avant chaque séance prévue, avec « C'est fait » et « Reporter à demain »")
                : tr("Active d'abord les notifications ci-dessus")
            }
            value={sessionRemindersOn && notifEnabled}
            disabled={!notifEnabled}
            onValueChange={(next) => {
              setSessionRemindersOn(next);
              setSessionRemindersEnabled(next).catch(() => {});
            }}
          />
          <View className="border-t border-border" />
          <SettingRow
            icon="shield-lock-outline"
            label={tr("Verrouillage {bioLabel}", { bioLabel: bioLabel })}
            description={
              bioAvailable
                ? tr("Demande une vérification à l'ouverture de l'app")
                : tr("Indisponible sur cet appareil")
            }
            value={bioEnabled}
            disabled={!bioAvailable}
            onValueChange={handleToggleBiometrics}
          />
        </View>
      </FadeInView>

      {/* Mesures de démarrage — développement uniquement.
          Les chiffres se lisent normalement dans le terminal Metro, mais le
          démarrage à mesurer est celui d'un VRAI iPhone avec de VRAIES données :
          il fallait pouvoir les relire sur l'appareil, sans terminal sous la
          main. `__DEV__` est remplacé par une constante à la compilation, donc
          ce bloc n'existe tout simplement pas dans une build de production. */}
      {__DEV__ ? (
        <FadeInView delay={490}>
          <TouchableOpacity
            className={`${CARD} flex-row items-center gap-3`}
            activeOpacity={0.7}
            onPress={() => {
              const report = startupTrace.report();
              const texte = [
                formatTrace(report),
                "",
                ...summarizeTrace(report),
                ...summarizeTrace(report, tr("écriture ")),
              ].join("\n");
              // Journalisé en plus de l'alerte : le texte complet reste
              // copiable depuis le terminal, là où une alerte iOS finirait par
              // tronquer un rapport devenu long.
              console.log(`[démarrage] mesures (origine : premier module JS)\n${texte}`);
              Alert.alert(tr("Mesures de démarrage"), texte);
            }}
          >
            <MaterialCommunityIcons name="timer-outline" size={22} color={colors.textMuted} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-text">{tr("Mesures de démarrage")}</Text>
              <Text className="text-xs text-muted">{tr("Visible en développement seulement")}</Text>
            </View>
          </TouchableOpacity>
        </FadeInView>
      ) : null}

      {/* Aide et bouche-à-oreille — un utilisateur qui bloque écrit ici
          plutôt que de laisser une note basse sur l'App Store ; un utilisateur
          content a de quoi recommander l'app à son écurie. */}
      <FadeInView delay={495}>
        <SectionTitle>{tr("Horsetrack")}</SectionTitle>
      </FadeInView>

      <FadeInView delay={498}>
        <View className={CARD}>
          <LinkRow
            icon="lifebuoy"
            label={tr("Contacter le support")}
            description={tr("Une question, un souci, une idée ? On répond vite.")}
            onPress={async () => {
              track("support_contacted");
              const opened = await openSupportEmail();
              if (!opened) Alert.alert(tr("Nous écrire"), tr("Écris-nous à {SUPPORT_EMAIL}", { SUPPORT_EMAIL: SUPPORT_EMAIL }));
            }}
          />
          <View className="border-t border-border" />
          <LinkRow
            icon="gift-outline"
            label={tr("Parrainer un ami")}
            description={tr("Un mois de Premium offert quand ton ami s'abonne")}
            onPress={() => router.push("/referral")}
          />
          <View className="border-t border-border" />
          <LinkRow
            icon="account-heart-outline"
            label={tr("Recommander Horsetrack")}
            description={tr("À ta DP, ton coach, ton écurie")}
            onPress={() => {
              track("app_recommended");
              Share.share({
                message: tr("J'utilise Horsetrack pour suivre mon cheval : planning, soins, concours et budget au même endroit.{v}", { v: DOWNLOAD_URL ? `\n${DOWNLOAD_URL}` : "" }),
              }).catch(() => {});
            }}
          />
          <View className="border-t border-border" />
          <LinkRow
            icon="card-account-phone-outline"
            label={tr("Mes contacts")}
            description={tr("Véto, maréchal, ostéo, coach : un toucher pour appeler.")}
            onPress={() => router.push("/contacts")}
          />
          <View className="border-t border-border" />
          <LinkRow
            icon="tray-arrow-down"
            label={exporting ? tr("Préparation de l'export…") : tr("Exporter mes données")}
            description={tr("Chevaux, séances, soins, journal, dépenses… en fichiers Excel")}
            onPress={() => void handleExport()}
          />
          {canOpenWriteReview() ? (
            <>
              <View className="border-t border-border" />
              <LinkRow
                icon="star-outline"
                label={tr("Noter Horsetrack")}
                description={tr("Ton avis aide d'autres cavaliers à nous trouver")}
                onPress={() => void openWriteReview()}
              />
            </>
          ) : null}
        </View>
      </FadeInView>

      {/* Compte */}
      <FadeInView delay={500}>
        <SectionTitle>{tr("Compte")}</SectionTitle>
      </FadeInView>

      <FadeInView delay={540}>
        <View className="gap-3">
          <TouchableOpacity
            className="items-center rounded-card border border-border bg-surface p-4"
            onPress={() => router.push("/change-password-modal")}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-text">{tr("Changer le mot de passe")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center rounded-card border border-border bg-surface p-4"
            onPress={signOut}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-text">{tr("Se déconnecter")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center rounded-card border border-danger/30 p-4"
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.85}
          >
            <Text className="font-semibold text-danger">
              {deletingAccount ? "Suppression…" : tr("Supprimer mon compte")}
            </Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={580}>
        <Text className="pt-2 text-center text-xs text-muted">{tr("Horsetrack · v")}{Constants.expoConfig?.version ?? "—"}</Text>
      </FadeInView>
    </Screen>
  );
}

export default lazyTab(ProfileScreen);
