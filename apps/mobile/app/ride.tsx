import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Share, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { ChipSelect } from "@/components/FormChips";
import { Field } from "@/components/Field";
import { useThemeColors } from "@/theme/ThemeProvider";
import { ACTIVITY_META, type ActivityType } from "@/agenda/store";
import { useHorses } from "@/horses/store";
import { useSelectableHorses } from "@/horses/useSelectableHorses";
import { useSessions } from "@/sessions/store";
import { useSubscription } from "@/subscription/store";
import { track } from "@/lib/analytics";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { ensureNotificationPermission } from "@/lib/notifications";
import {
  activeSeconds,
  classifyGait,
  currentSpeedKmh,
  decodePolyline,
  formatClock,
  formatDistance,
  formatSpeed,
  summarizeRide,
} from "@/rides/rideMath";
import {
  buildSessionRide,
  clearRide,
  finishRide,
  isRidePaused,
  pauseRide,
  resumeRide,
  startRide,
  type RideDraft,
} from "@/rides/recorder";
import {
  acknowledgeSafetyCheck,
  endRideSafety,
  loadSafetySettings,
  saveSafetySettings,
  sendManualAlert,
  startRideSafety,
  type SafetySettings,
} from "@/rides/safety";
import { cleanContacts } from "@/rides/safetyLogic";
import { useNow, useRideDraft, useSafetyState } from "@/rides/useRide";
import { RouteTrace } from "@/rides/components/RouteTrace";
import { GAIT_LABEL, GaitBreakdown } from "@/rides/components/GaitBreakdown";
import { SafetySetupCard } from "@/rides/components/SafetySetupCard";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Activités proposées au départ : le repos ne s'enregistre pas en direct. */
const RIDE_ACTIVITIES: ActivityType[] = ["balade", "dressage", "cso", "cross", "endurance", "trec", "longe", "travail_a_pied"];

/**
 * Séance en direct : préparation → chrono/GPS → bilan. Trois écrans en un,
 * pilotés par l'enregistreur (rides/recorder.ts) : quitter l'écran pendant la
 * séance ne l'arrête pas, on y revient depuis l'Accueil ou la notification.
 *
 * Paramètres : `sessionId` (séance prévue qu'on démarre), `horseId`.
 */
/** Retour à l'écran précédent ; à l'Accueil si la séance a été ouverte
 * directement (notification « Tout va bien ? » app fermée), sans écran
 * dessous. Jamais `push` vers les onglets depuis un écran empilé (cf.
 * horses/horseHubNavigation.test.ts). */
function closeRide() {
  if (router.canGoBack()) router.back();
  else router.dismissTo("/(tabs)/today");
}

export default function RideScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; horseId?: string }>();
  const draft = useRideDraft();

  if (draft?.endedAt != null) return <RideSummaryView draft={draft} endedAt={draft.endedAt} />;
  if (draft) return <RideLiveView draft={draft} />;
  return <RideSetupView sessionId={params.sessionId ?? null} horseIdParam={params.horseId ?? null} />;
}

// --- Préparation ---------------------------------------------------------------

function RideSetupView({ sessionId, horseIdParam }: { sessionId: string | null; horseIdParam: string | null }) {
  const colors = useThemeColors();
  const { selectedHorse } = useHorses();
  const horses = useSelectableHorses();
  const { sessions } = useSessions();
  const { isActiveOrTrialing } = useSubscription();
  const planned = sessionId ? (sessions.find((s) => s.id === sessionId) ?? null) : null;

  const [horseId, setHorseId] = useState<string | null>(
    planned?.horseId ?? horseIdParam ?? selectedHorse?.id ?? horses[0]?.id ?? null
  );
  const [activity, setActivity] = useState<ActivityType>(
    planned && planned.activityType !== "repos" ? planned.activityType : "balade"
  );
  const [gps, setGps] = useState(true);
  const [safety, setSafety] = useState<SafetySettings>({ enabled: false, riderName: "", contacts: [] });
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadSafetySettings()
      .then(setSafety)
      .catch(() => {});
  }, []);

  const horse = horses.find((h) => h.id === horseId) ?? null;
  const safetyOn = isActiveOrTrialing && safety.enabled && gps;

  async function handleStart() {
    if (!horse || starting) return;
    const contacts = cleanContacts(safety.contacts);
    if (safetyOn) {
      if (!safety.riderName.trim() || contacts.length === 0) {
        Alert.alert(
          t("Proches incomplets"),
          t("Indique ton prénom et au moins un proche avec son email, ou désactive « Prévenir mes proches ».")
        );
        return;
      }
      // La vérification « Tout va bien ? » passe par une notification.
      const allowed = await ensureNotificationPermission();
      if (!allowed) {
        Alert.alert(
          t("Notifications désactivées"),
          t("Sans notifications, Horsetrack ne pourra pas te demander si tout va bien avant d'alerter tes proches. Active-les dans les réglages du téléphone.")
        );
        return;
      }
    }
    setStarting(true);
    try {
      await saveSafetySettings({ ...safety, contacts }).catch(() => {});
      const result = await startRide({
        sessionId: planned?.id ?? null,
        horseId: horse.id,
        activityType: activity,
        customActivityLabel: planned?.activityType === activity ? planned.customActivityLabel : null,
        gps,
      });
      if (!result.ok) {
        Alert.alert(
          result.reason === "permission" ? t("Position non autorisée") : t("GPS indisponible"),
          result.reason === "permission"
            ? t("Autorise la position « pendant l'utilisation » pour suivre ton parcours, ou démarre sans GPS.")
            : t("Le GPS n'a pas pu démarrer. Réessaie, ou démarre sans GPS."),
          result.reason === "permission"
            ? [
                { text: t("Annuler"), style: "cancel" },
                { text: t("Réglages"), onPress: () => void Linking.openSettings() },
              ]
            : undefined
        );
        return;
      }
      hapticTap();
      track("ride_started", { gps, activity, planned: !!planned, safety: safetyOn });
      if (safetyOn) {
        const res = await startRideSafety({ riderName: safety.riderName, horseName: horse.name, contacts });
        if (!res.ok) {
          Alert.alert(
            t("Suivi non partagé"),
            res.reason === "premium"
              ? t("La sécurité en balade est réservée aux comptes Premium.")
              : res.reason === "limit"
                ? t("Trop de balades suivies aujourd'hui. La séance est enregistrée, sans partage.")
                : t("Pas de réseau pour prévenir tes proches. La séance est enregistrée, sans partage.")
          );
        }
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Séance en direct")}
            </Text>
            <Text className="text-sm text-muted">
              {t("Chrono, distance et allures, même écran verrouillé. La séance s'ajoute à ton planning.")}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Fermer")} onPress={() => closeRide()} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={40}>
        <View className={`${CARD} gap-4`}>
          {horses.length > 1 ? (
            <Field label={t("Cheval")}>
              <ChipSelect
                options={horses.map((h) => ({ value: h.id, label: h.name, icon: "horse-variant" }))}
                value={horseId}
                onChange={setHorseId}
              />
            </Field>
          ) : null}
          <Field label={t("Activité")}>
            <ChipSelect
              options={RIDE_ACTIVITIES.map((a) => ({ value: a, label: ACTIVITY_META[a].label, icon: ACTIVITY_META[a].icon }))}
              value={activity}
              onChange={setActivity}
            />
          </Field>
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-text">{t("Suivre le parcours (GPS)")}</Text>
              <Text className="text-xs text-muted">{t("Distance, vitesse, allures et tracé. À couper en manège couvert.")}</Text>
            </View>
            <Switch
              value={gps}
              onValueChange={setGps}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t("Suivre le parcours avec le GPS")}
            />
          </View>
        </View>
      </FadeInView>

      {gps ? (
        <FadeInView delay={80}>
          <SafetySetupCard premium={isActiveOrTrialing} settings={safety} onChange={setSafety} />
        </FadeInView>
      ) : null}

      <FadeInView delay={120}>
        <TouchableOpacity
          className={`flex-row items-center justify-center gap-2 rounded-card p-5 ${horse ? "bg-primary" : "bg-border"}`}
          onPress={() => void handleStart()}
          disabled={!horse || starting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !horse || starting }}
        >
          <MaterialCommunityIcons name="play" size={22} color={colors.textOnPrimary} />
          <Text className="text-lg font-bold text-on-primary">{starting ? t("Démarrage…") : t("Démarrer")}</Text>
        </TouchableOpacity>
        {!horse ? <Text className="pt-2 text-center text-sm text-muted">{t("Ajoute d'abord un cheval.")}</Text> : null}
      </FadeInView>
    </Screen>
  );
}

// --- En cours --------------------------------------------------------------------

function RideLiveView({ draft }: { draft: RideDraft }) {
  useKeepAwake();
  const colors = useThemeColors();
  const { horses } = useHorses();
  const safety = useSafetyState();
  const paused = isRidePaused(draft);
  const now = useNow(!paused);
  const [busy, setBusy] = useState(false);

  const horse = horses.find((h) => h.id === draft.horseId) ?? null;
  const elapsed = activeSeconds(draft.startedAt, draft.pauses, now);
  const stats = useMemo(() => summarizeRide(draft.points, draft.pauses, draft.startedAt, now), [draft, now]);
  const speed = draft.points.length ? currentSpeedKmh(draft.points) : 0;
  const lastPointAge = draft.points.length ? now - draft.points[draft.points.length - 1].t : Infinity;
  const gpsLive = lastPointAge < 15_000;
  const gait = gpsLive ? classifyGait(speed) : null;

  async function handleFinish() {
    Alert.alert(t("Terminer la séance ?"), undefined, [
      { text: t("Continuer"), style: "cancel" },
      {
        text: t("Terminer"),
        onPress: async () => {
          setBusy(true);
          const finished = await finishRide();
          if (finished) {
            void endRideSafety(finished.safety);
            hapticSuccess();
          }
          setBusy(false);
        },
      },
    ]);
  }

  function handleSos() {
    Alert.alert(t("Prévenir tes proches maintenant ?"), t("Ils reçoivent un email d'alerte avec ta dernière position."), [
      { text: t("Annuler"), style: "cancel" },
      {
        text: t("Prévenir"),
        style: "destructive",
        onPress: async () => {
          const ok = await sendManualAlert();
          Alert.alert(ok ? t("Alerte envoyée") : t("Envoi impossible"), ok ? undefined : t("Pas de réseau. Appelle le 112 en cas d'urgence."));
        },
      },
    ]);
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Réduire")} onPress={() => closeRide()} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-down" size={28} color={colors.textMuted} />
        </TouchableOpacity>
        <Text className="text-sm font-semibold text-muted">
          {ACTIVITY_META[draft.activityType].label}
          {horse ? ` · ${horse.name}` : ""}
        </Text>
        <View className="w-7" />
      </View>

      {safety.checkStartedAt !== null ? (
        <View className="gap-3 rounded-card border border-warning bg-warning/15 p-4" accessibilityLiveRegion="assertive">
          <Text className="text-base font-bold text-text">{t("Tout va bien ?")}</Text>
          <Text className="text-sm text-text">
            {t("Tu n'as pas bougé depuis 5 minutes. Sans réponse, tes proches seront prévenus dans 2 minutes.")}
          </Text>
          <TouchableOpacity
            className="items-center rounded-card bg-primary p-3"
            accessibilityRole="button"
            onPress={acknowledgeSafetyCheck}
          >
            <Text className="font-bold text-on-primary">{t("Je vais bien")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="items-center gap-1 py-4" accessible accessibilityLabel={t("Durée {formatClock}", { formatClock: formatClock(elapsed) })}>
        <Text className="text-6xl font-display-bold text-text" style={{ fontVariant: ["tabular-nums"] }}>
          {formatClock(elapsed)}
        </Text>
        <Text className="text-sm font-semibold text-muted">
          {paused ? t("En pause") : draft.gps ? (gait ? t("{v} (estimé)", { v: GAIT_LABEL[gait] }) : t("Recherche du GPS…")) : t("Chrono seul")}
        </Text>
      </View>

      {draft.gps ? (
        <View className="flex-row gap-3">
          <View className={`${CARD} flex-1 items-center gap-1`}>
            <Text className="text-xs font-bold uppercase tracking-wide text-muted">{t("Distance")}</Text>
            <Text className="text-2xl font-bold text-text">{formatDistance(stats.distanceMeters)}</Text>
          </View>
          <View className={`${CARD} flex-1 items-center gap-1`}>
            <Text className="text-xs font-bold uppercase tracking-wide text-muted">{t("Vitesse")}</Text>
            <Text className="text-2xl font-bold text-text">{gpsLive ? formatSpeed(speed) : "—"}</Text>
          </View>
        </View>
      ) : null}

      {draft.gps && draft.points.length > 1 ? <RouteTrace coords={draft.points} height={160} /> : null}

      {draft.safety ? (
        <View className={`${CARD} flex-row items-center gap-3`}>
          <MaterialCommunityIcons
            name={safety.alertSent ? "alert-circle" : "shield-check-outline"}
            size={22}
            color={safety.alertSent ? colors.danger : colors.success}
          />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text">
              {safety.alertSent ? t("Tes proches ont été alertés") : t("Tes proches suivent ta position")}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void Share.share({ message: t("Suis ma séance à cheval en direct : {viewUrl}", { viewUrl: draft.safety!.viewUrl }) })}
            >
              <Text className="text-xs font-semibold text-accent">{t("Partager le lien par message")}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            className="rounded-full border border-danger px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel={t("Prévenir mes proches maintenant")}
            onPress={handleSos}
          >
            <Text className="text-xs font-bold text-danger">{t("Alerter")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="flex-row gap-3 pt-2">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-2 rounded-card border border-border bg-surface p-5"
          onPress={() => (paused ? resumeRide() : pauseRide())}
          disabled={busy}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name={paused ? "play" : "pause"} size={22} color={colors.text} />
          <Text className="text-base font-bold text-text">{paused ? t("Reprendre") : t("Pause")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-2 rounded-card bg-primary p-5"
          onPress={() => void handleFinish()}
          disabled={busy}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="stop" size={22} color={colors.textOnPrimary} />
          <Text className="text-base font-bold text-on-primary">{t("Terminer")}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

// --- Bilan -------------------------------------------------------------------------

function RideSummaryView({ draft, endedAt }: { draft: RideDraft; endedAt: number }) {
  const colors = useThemeColors();
  const { horses } = useHorses();
  const { saveRide } = useSessions();
  const [notes, setNotes] = useState("");
  // Un double toucher sur « Enregistrer » créait deux séances.
  const [saving, setSaving] = useState(false);
  const ride = useMemo(() => buildSessionRide(draft, endedAt), [draft, endedAt]);
  const horse = horses.find((h) => h.id === draft.horseId) ?? null;
  const route = useMemo(() => (ride.route ? decodePolyline(ride.route) : []), [ride.route]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    saveRide({
      sessionId: draft.sessionId,
      horseId: draft.horseId,
      activityType: draft.activityType,
      customActivityLabel: draft.customActivityLabel,
      notes,
      ride,
    });
    await clearRide();
    closeRide();
  }

  function handleDiscard() {
    Alert.alert(t("Supprimer cette séance ?"), t("Le chrono et le parcours seront perdus."), [
      { text: t("Garder"), style: "cancel" },
      {
        text: t("Supprimer"),
        style: "destructive",
        onPress: async () => {
          track("ride_discarded", { seconds: ride.durationSeconds });
          await clearRide();
          closeRide();
        },
      },
    ]);
  }

  return (
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
            {t("Bravo !")}
          </Text>
          <Text className="text-sm text-muted">
            {ACTIVITY_META[draft.activityType].label}
            {horse ? t(" avec {name}", { name: horse.name }) : ""}
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={40}>
        <View className={`${CARD} gap-4`}>
          <View className="flex-row justify-between">
            <Stat label={t("Durée")} value={formatClock(ride.durationSeconds)} />
            {ride.gps ? <Stat label={t("Distance")} value={formatDistance(ride.distanceMeters)} /> : null}
            {ride.gps ? <Stat label={t("Vitesse moy.")} value={formatSpeed(ride.avgSpeedKmh)} /> : null}
          </View>
          {ride.gps ? (
            <>
              <GaitBreakdown
                seconds={{ walk: ride.walkSeconds, trot: ride.trotSeconds, canter: ride.canterSeconds, halt: ride.haltSeconds }}
              />
              <Text className="text-xs text-muted">{t("Allures estimées d'après la vitesse.")}</Text>
            </>
          ) : null}
        </View>
      </FadeInView>

      {route.length > 1 ? (
        <FadeInView delay={80}>
          <RouteTrace coords={route} />
        </FadeInView>
      ) : null}

      <FadeInView delay={120}>
        <Field label={t("Un mot sur la séance (facultatif)")}>
          <TextInput
            className={INPUT}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("Très bon travail au trot…")}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
          />
        </Field>
      </FadeInView>

      <FadeInView delay={160}>
        <View className="gap-3">
          <TouchableOpacity
            className="items-center rounded-card bg-primary p-5"
            onPress={() => void handleSave()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
          >
            <Text className="text-lg font-bold text-on-primary">{t("Enregistrer la séance")}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center p-3" onPress={handleDiscard} accessibilityRole="button">
            <Text className="text-sm font-semibold text-danger">{t("Supprimer")}</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center gap-1" accessible accessibilityLabel={`${label} ${value}`}>
      <Text className="text-xs font-bold uppercase tracking-wide text-muted">{label}</Text>
      <Text className="text-xl font-bold text-text">{value}</Text>
    </View>
  );
}
