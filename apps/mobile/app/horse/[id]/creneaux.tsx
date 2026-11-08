import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { TimePickerField } from "@/components/TimePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { PrimaryButton } from "@/components/onboarding";
import { AddToggle, ChipSelect } from "@/components/FormChips";
import { ReadOnlyNote } from "@/components/ReadOnlyNote";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseRights } from "@/horses/useHorseRights";
import { useHorseTeam } from "@/horses/team";
import { useHorseDetails } from "@/extras/store";
import { useSubscription } from "@/subscription/store";
import { useSessions } from "@/sessions/store";
import { RiderField, type RiderValue } from "@/planning/components/RiderField";
import { assignableRiders, riderColumns, riderDisplayName } from "@/planning/riders";
import { activeSlots, slotOccurrences, type SlotKind } from "@/planning/slots";
import { endSlot, migrateHorsePartnership, saveSlot, useSlots } from "@/planning/slotsStore";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { formatDate } from "@/lib/dateFormat";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: t("Lun"), long: t("Lundi") },
  { value: 2, short: t("Mar"), long: t("Mardi") },
  { value: 3, short: t("Mer"), long: t("Mercredi") },
  { value: 4, short: t("Jeu"), long: t("Jeudi") },
  { value: 5, short: t("Ven"), long: t("Vendredi") },
  { value: 6, short: t("Sam"), long: t("Samedi") },
  { value: 7, short: t("Dim"), long: t("Dimanche") },
];

const KIND_LABEL: Record<SlotKind, string> = {
  DP: t("Demi-pension"),
  LESSON: t("Cours"),
  WORK: t("Travail"),
};

type Draft = RiderValue & { weekdays: number[]; startTime: string; endTime: string; kind: SlotKind };

const EMPTY_DRAFT: Draft = {
  weekdays: [],
  startTime: "",
  endTime: "",
  kind: "DP",
  riderUserId: null,
  riderName: "",
  riderOther: false,
};

/**
 * Créneaux réguliers d'un cheval (Écurie Pro v2) : qui monte, quels jours,
 * à quelle heure. Ils apparaissent chaque semaine dans le planning sans créer
 * de séance à l'avance (cf. planning/slots.ts). Modifiables par le coach, le
 * gérant ou le propriétaire d'un compte Écurie Pro ; lisibles par l'équipe.
 */
export default function HorseSlotsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { horses } = useHorses();
  const horse = horses.find((h) => h.id === id);
  const rights = useHorseRights();
  const { isPro } = useSubscription();
  const team = useHorseTeam(horse?.id);
  const partnership = useHorseDetails(id)?.partnership ?? null;
  const allSlots = useSlots();
  const { sessions } = useSessions();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [notice, setNotice] = useState<string | null>(null);
  const migrationTried = useRef(false);

  const isOwner = !!horse && !horse.sharedRole;
  // Le serveur refuse hors Écurie Pro ; pour un cheval partagé, c'est
  // l'abonnement de son propriétaire qui compte (inconnu ici) : la base
  // tranche, l'écran propose si le rôle le permet.
  const canEdit = !!horse && rights.can(horse.id, "manage_planning") && (!isOwner || isPro);
  const today = useMemo(() => new Date(), []);
  const slots = useMemo(() => activeSlots(allSlots.filter((s) => s.horseId === id), today), [allSlots, id, today]);
  const week = useMemo(() => {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
    return slotOccurrences(slots, sessions, today, end);
  }, [slots, sessions, today]);

  // Première ouverture en Écurie Pro : les jours de demi-pension de la fiche
  // deviennent des créneaux (une fois, sans doublon côté serveur).
  const partnershipDays = partnership?.days.length ?? 0;
  useEffect(() => {
    if (migrationTried.current || !horse || !isOwner || !isPro || partnershipDays === 0 || slots.length > 0) return;
    migrationTried.current = true;
    migrateHorsePartnership(horse.id)
      .then((created) => {
        if (created > 0) {
          track("partnership_slots_migrated", { count: created });
          setNotice(t("Les jours de demi-pension de la fiche sont devenus des créneaux."));
        }
      })
      .catch(() => {});
  }, [horse, isOwner, isPro, partnershipDays, slots.length]);

  if (!horse) {
    return (
      <Screen>
        <View className={`${CARD} items-center gap-2`}>
          <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
        </View>
      </Screen>
    );
  }

  const riderName = (slot: { riderUserId: string | null; riderName: string | null }) =>
    riderDisplayName(slot, team, rights.me, t("Toi")) ?? t("Personne en particulier");

  function toggleWeekday(day: number) {
    hapticSelection();
    setDraft((d) => ({
      ...d,
      weekdays: d.weekdays.includes(day) ? d.weekdays.filter((x) => x !== day) : [...d.weekdays, day].sort(),
    }));
  }

  function handleSave() {
    if (!horse || draft.weekdays.length === 0) return;
    const rider = riderColumns(draft.riderUserId, draft.riderOther ? draft.riderName : "");
    const validFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (const weekday of draft.weekdays) {
      saveSlot({
        horseId: horse.id,
        ...rider,
        weekday,
        startTime: draft.startTime || null,
        endTime: draft.endTime || null,
        validFrom,
        validUntil: null,
        kind: draft.kind,
        activityType: null,
        notes: "",
      });
    }
    track("slot_created", { count: draft.weekdays.length, kind: draft.kind, account: !!rider.riderUserId });
    hapticSuccess();
    animateNextLayout();
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
    setNotice(draft.weekdays.length > 1 ? t("Créneaux ajoutés.") : t("Créneau ajouté."));
  }

  function confirmEnd(slotId: string, label: string) {
    Alert.alert(t("Arrêter ce créneau ?"), t("{label} n'apparaîtra plus dans le planning. Les séances déjà faites restent.", { label }), [
      { text: t("Annuler"), style: "cancel" },
      {
        text: t("Arrêter"),
        style: "destructive",
        onPress: () => {
          const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
          animateNextLayout();
          endSlot(slotId, yesterday);
          track("slot_ended", {});
        },
      },
    ]);
  }

  const timeLabel = (start: string | null, end: string | null) =>
    start ? (end ? `${start} – ${end}` : start) : t("Horaire libre");

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-1">
              <Text className="font-display text-2xl tracking-tight text-text" accessibilityRole="header">
                {t("Créneaux réguliers")}
              </Text>
              <Text className="text-sm text-muted">{horse.name}</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        {notice ? (
          <View className="flex-row items-center gap-2 rounded-card bg-success/15 p-4" accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
            <Text className="flex-1 text-sm text-text">{notice}</Text>
          </View>
        ) : null}

        {isOwner && !isPro ? (
          <FadeInView delay={40}>
            <View className={`${CARD} gap-3`}>
              <Text className="text-base font-semibold text-text">{t("Qui monte, et quand")}</Text>
              <Text className="text-sm text-muted">
                {t("Fixe les jours de ta demi-pension, de tes cours et de ton cavalier : ils apparaissent chaque semaine dans le planning de chacun. Avec Écurie Pro.")}
              </Text>
              <PrimaryButton
                label={t("Découvrir Écurie Pro")}
                onPress={() => router.push("/pro")}
              />
            </View>
          </FadeInView>
        ) : null}

        <FadeInView delay={60}>
          <View className="gap-2">
            {slots.length === 0 ? (
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="calendar-sync-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-center text-sm text-muted">
                  {canEdit
                    ? t("Aucun créneau. Ajoute les jours où chacun monte {name} : ils reviendront chaque semaine.", { name: horse.name })
                    : t("Aucun créneau régulier pour {name}.", { name: horse.name })}
                </Text>
              </View>
            ) : (
              slots.map((slot) => {
                const day = WEEKDAYS.find((w) => w.value === slot.weekday)?.long ?? "";
                const label = `${day} · ${timeLabel(slot.startTime, slot.endTime)}`;
                return (
                  <View key={slot.id} className={`${CARD} flex-row items-center gap-3`}>
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-highlight">
                      <MaterialCommunityIcons name="calendar-sync-outline" size={20} color={colors.primary} />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-bold text-text">{label}</Text>
                      <Text className="text-sm text-muted">
                        {riderName(slot)} · {KIND_LABEL[slot.kind]}
                      </Text>
                    </View>
                    {canEdit ? (
                      <TouchableOpacity
                        onPress={() => confirmEnd(slot.id, label)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("Arrêter le créneau {label}", { label })}
                      >
                        <MaterialCommunityIcons name="calendar-remove-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </FadeInView>

        {canEdit ? (
          <FadeInView delay={80}>
            {showForm ? (
              <View className={`${CARD} gap-4`}>
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">{t("Nouveau créneau")}</Text>
                <Field label={t("Jours")}>
                  <View className="flex-row flex-wrap gap-2">
                    {WEEKDAYS.map((w) => {
                      const selected = draft.weekdays.includes(w.value);
                      return (
                        <TouchableOpacity
                          key={w.value}
                          onPress={() => toggleWeekday(w.value)}
                          activeOpacity={0.8}
                          accessibilityRole="checkbox"
                          accessibilityLabel={w.long}
                          accessibilityState={{ checked: selected }}
                          className={`h-11 w-11 items-center justify-center rounded-full border ${
                            selected ? "border-primary bg-highlight" : "border-border bg-surface"
                          }`}
                        >
                          <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{w.short}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <TimePickerField label={t("Début")} value={draft.startTime} onChange={(startTime) => setDraft((d) => ({ ...d, startTime }))} />
                  </View>
                  <View className="flex-1">
                    <TimePickerField label={t("Fin")} value={draft.endTime} onChange={(endTime) => setDraft((d) => ({ ...d, endTime }))} />
                  </View>
                </View>
                <Field label={t("Pour")}>
                  <ChipSelect
                    options={(Object.keys(KIND_LABEL) as SlotKind[]).map((k) => ({
                      value: k,
                      label: KIND_LABEL[k],
                      icon: k === "DP" ? "handshake-outline" : k === "LESSON" ? "school-outline" : "horse-variant",
                    }))}
                    value={draft.kind}
                    onChange={(kind) => {
                      hapticSelection();
                      setDraft((d) => ({ ...d, kind }));
                    }}
                  />
                </Field>
                <RiderField
                  members={assignableRiders(rights.roleFor(horse.id), team, rights.me)}
                  me={rights.me}
                  allowOther
                  value={draft}
                  onChange={(rider) => setDraft((d) => ({ ...d, ...rider }))}
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      animateNextLayout();
                      setShowForm(false);
                      setDraft(EMPTY_DRAFT);
                    }}
                    accessibilityRole="button"
                    className="flex-1 items-center rounded-card border border-border p-4"
                  >
                    <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <PrimaryButton label={t("Ajouter")} disabled={draft.weekdays.length === 0} onPress={handleSave} />
                  </View>
                </View>
              </View>
            ) : (
              <AddToggle label={t("Ajouter un créneau")} onPress={() => setShowForm(true)} color={colors.primary} />
            )}
          </FadeInView>
        ) : slots.length > 0 ? (
          <ReadOnlyNote text={t("Le coach, le gérant ou le propriétaire organisent les créneaux.")} />
        ) : null}

        {week.length > 0 ? (
          <FadeInView delay={100}>
            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted">{t("Les 7 prochains jours")}</Text>
              {week.map((o) => (
                <View key={o.id} className="flex-row items-center justify-between rounded-card bg-surface px-4 py-3">
                  <Text className="text-sm text-text">
                    {formatDate(o.date)} · {timeLabel(o.slot.startTime, o.slot.endTime)}
                  </Text>
                  <Text className={`text-sm ${o.session?.completed ? "font-semibold text-success" : "text-muted"}`}>
                    {o.session?.completed ? t("Fait") : riderName(o.slot)}
                  </Text>
                </View>
              ))}
            </View>
          </FadeInView>
        ) : null}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
