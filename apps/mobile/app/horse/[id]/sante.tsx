import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { useScrollToOnOpen } from "@/components/useScrollToOnOpen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseRights } from "@/horses/useHorseRights";
import { useWeight } from "@/horses/weightStore";
import { exportHealthRecord } from "@/horses/exportHealthRecord";
import { useSubscription } from "@/subscription/store";
import { useAgenda, daysFromNow, type Appointment } from "@/agenda/store";
import { APPT_META, HEALTH_APPT_TYPES, capitalize, daysUntilLabel } from "@/agenda/meta";
import { formatDate } from "@/lib/dateFormat";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { HealthHistory } from "@/horses/components/HealthHistory";
import { splitHealthHistory } from "@/horses/healthListLogic";
import { SwipeableRow } from "@/components/SwipeableRow";
import { LIST_PAGE_SIZE, ShowMoreButton } from "@/components/ShowMoreButton";
import { SubScreenHeader } from "@/components/SubScreenHeader";
import { t } from "@/i18n";
import { useToast } from "@/components/Toast";
import { animateNextLayout } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/haptics";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Historique santé + ajout/édition d'un rendez-vous de soin, en place sur cet
 * écran (cf. audit crash du 2026-09-05) : avant, "Ajouter ou modifier un
 * rendez-vous santé" renvoyait vers l'ancien onglet Agenda via un
 * router.push cross-navigateur (hors du groupe (tabs), vers un onglet caché
 * href:null) — un détour fragile qui n'apportait rien, cet écran affichant
 * déjà les mêmes rendez-vous en lecture seule juste au-dessus. On réutilise
 * exactement les mêmes hooks/formulaire que Horse Hub/Today/Planning
 * (useAppointmentForm/AppointmentForm, déjà éprouvés là), aucune nouvelle
 * logique métier ni nouveau modèle.
 */
export default function HorseSanteScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const { appointments, addAppointment, updateAppointment, removeAppointmentUndoable } = useAgenda();
  const toast = useToast();
  const { measurements } = useWeight();

  const horse = horses.find((h) => h.id === id);
  // Cheval partagé : soins ajoutés par le groom ou le véto, modifiés par leur
  // auteur, le propriétaire ou le gérant (cf. lib/permissions.ts).
  const rights = useHorseRights();

  // Consulter cet écran ne change pas le cheval actif global (même règle que
  // le Horse Hub, cf. app/horse/[id]/index.tsx) : le formulaire de soin vise
  // déjà `horse` explicitement (cf. useAppointmentForm ci-dessous), donc rien
  // ici n'a besoin du cheval globalement sélectionné.

  const [, setNotifPermission] = useState<boolean | null>(null);
  const {
    showApptForm,
    setShowApptForm,
    apptForm,
    setApptForm,
    submittingAppt,
    editingApptId,
    reminderUnlocked,
    startEditAppt,
    cancelApptForm,
    handleSubmitAppointment,
    addApptFormEntry,
    updateApptFormEntry,
    removeApptFormEntry,
  } = useAppointmentForm({
    horse: horse ?? null,
    appointments,
    addAppointment,
    updateAppointment,
    isActiveOrTrialing,
    setNotifPermission,
    onEditStart: () => {},
  });
  const { scrollRef, onAnchorLayout: onFormLayout } = useScrollToOnOpen(showApptForm);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  if (!horse) {
    return (
      <Screen>
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  const today = daysFromNow(0);
  const history = appointments
    .filter((a) => a.horseId === horse.id && (HEALTH_APPT_TYPES as readonly string[]).includes(a.type))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const { upcoming, past } = splitHealthHistory(history, today);

  /** Carnet de santé en PDF — à envoyer au vétérinaire, emmener en concours
   * ou remettre à l'acheteur. Tout ce qu'il contient était déjà dans l'app,
   * mais ne sortait que sous forme de texte partagé, inutile face à un véto.
   * Les données sont préparées ici (l'écran les a déjà), la mise en forme
   * vit dans horses/healthRecord.ts. */
  function handleExportRecord() {
    if (!horse) return;
    exportHealthRecord(
      {
        name: horse.name,
        birthYear: horse.birthYear,
        sex: horse.sex,
        breed: horse.breed,
        coat: horse.coat,
        heightCm: horse.heightCm,
        weightKg: horse.weightKg,
        healthConditions: horse.healthConditions,
        injuries: horse.injuries.map((i) => ({
          type: i.type,
          occurredAt: i.occurredAt,
          // Le modèle porte un statut, pas une date de rétablissement (cf.
          // horses/injuries.ts) : le carnet dit donc « rétabli », sans quand.
          recovered: i.recoveryStatus === "RECOVERED",
          note: i.note,
        })),
      },
      // `history` est déjà filtré sur les types de santé : un concours n'a
      // rien à faire dans un carnet de santé.
      history.map((a) => ({
        type: a.type,
        typeLabel: APPT_META[a.type].label,
        title: a.title,
        date: a.date,
        professional: a.professional,
        nextDueDate: a.nextDueDate,
        notes: a.notes,
      })),
      measurements.filter((m) => m.horseId === horse.id).map((m) => ({ date: m.date, weightKg: m.weightKg }))
    );
  }

  function statusFor(appt: Appointment): { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string } {
    if (appt.date <= today) return { label: t("Effectué"), icon: "check-circle-outline", color: colors.success };
    // Un soin prévu n'est pas une alerte : couleur des liens, pas l'orange
    // d'avertissement.
    return { label: capitalize(daysUntilLabel(appt.date)), icon: "clock-outline", color: colors.link };
  }

  // Même geste que le Planning et le Journal : suppression immédiate et
  // « Annuler » pendant quelques secondes, au lieu d'une alerte « définitive ».
  function confirmDeleteAppt(appt: Appointment) {
    const removal = removeAppointmentUndoable(appt.id);
    if (!removal) return;
    hapticTap();
    animateNextLayout();
    track("item_deleted", { kind: "appointment", undoable: true });
    toast.showUndo(t("Soin supprimé"), {
      commit: removal.commit,
      undo: () => {
        animateNextLayout();
        removal.undo();
        track("deletion_undone", { kind: "appointment" });
      },
    });
  }

  function startAddAppt() {
    // Pré-sélectionne un type de soin (cf. HEALTH_APPT_TYPES) plutôt que le
    // premier type de l'énumération complète (qui inclut concours/autre, hors
    // sujet sur cet écran) — l'utilisateur garde la main pour changer le type
    // dans le sélecteur du formulaire.
    setApptForm((f) => ({ ...f, type: "veto" }));
    setShowApptForm(true);
  }

  function renderAppt(appt: Appointment) {
    const meta = APPT_META[appt.type];
    const status = statusFor(appt);
    // "jusqu'au [prochaine échéance]" pour un traitement en cours
    // (durée), simple ligne "Prochaine échéance" pour les autres
    // types (vaccin, vermifuge...) — même champ nextDueDate déjà
    // existant, pas de nouvelle donnée.
    const isTreatmentRange = appt.type === "traitement" && appt.nextDueDate;
    const writable = rights.appointment(appt);
    const card = (
      <TouchableOpacity
        onPress={() => startEditAppt(appt)}
        disabled={!writable}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityHint={writable ? t("Toucher pour modifier") : undefined}
        // La corbeille de 16 pt est remplacée par le balayage (comme Mail) ;
        // VoiceOver, qui ne balaie pas, garde la suppression dans ses actions.
        accessibilityActions={writable ? [{ name: "delete", label: t("Supprimer") }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "delete") confirmDeleteAppt(appt);
        }}
        className={`${CARD} flex-row items-center gap-3`}
      >
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-body font-bold text-text">{meta.label}</Text>
          <Text className="text-subhead text-muted">
            {isTreatmentRange ? `${formatDate(appt.date)} → ${formatDate(appt.nextDueDate!)}` : formatDate(appt.date)}
            {appt.professional ? ` · ${appt.professional}` : ""}
          </Text>
          {!isTreatmentRange && appt.nextDueDate ? (
            <Text className="text-footnote text-link">
              {t("Prochaine échéance : ")}
              {formatDate(appt.nextDueDate)}
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1">
          <MaterialCommunityIcons name={status.icon} size={16} color={status.color} />
          <Text className="text-footnote font-semibold" style={{ color: status.color }}>
            {status.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
    return (
      <View key={appt.id}>
        {writable ? (
          <SwipeableRow
            trailing={{ label: t("Supprimer"), icon: "trash-can-outline", color: colors.danger, onPress: () => confirmDeleteAppt(appt) }}
          >
            {card}
          </SwipeableRow>
        ) : (
          card
        )}
      </View>
    );
  }

  return (
    <>
      <Screen scrollRef={scrollRef}>
        <FadeInView>
          <SubScreenHeader title={t("Santé")} subtitle={horse.name} />
        </FadeInView>

        {/* Modifier un soin plus bas dans la liste ouvre le formulaire ici,
            en haut : on y ramène l'écran (cf. useScrollToOnOpen). */}
        <View onLayout={onFormLayout}>
        {rights.can(horse.id, "add_care") || rights.can(horse.id, "manage_competitions") ? (
        <FadeInView delay={40}>
          <AppointmentForm
            show={showApptForm}
            form={apptForm}
            setForm={setApptForm}
            editingApptId={editingApptId}
            reminderUnlocked={reminderUnlocked}
            submitting={submittingAppt}
            targetHorseName={horse.name}
            onOpen={startAddAppt}
            onCancel={cancelApptForm}
            onSubmit={handleSubmitAppointment}
            onAddEntry={addApptFormEntry}
            onUpdateEntry={updateApptFormEntry}
            onRemoveEntry={removeApptFormEntry}
          />
        </FadeInView>
        ) : null}
        </View>

        {/* Ce qui arrive d'abord, puis l'historique (cf. healthListLogic.ts),
            puis les antécédents et l'export : on vient surtout vérifier la
            prochaine échéance. Tout est masqué pendant la saisie. */}
        {!showApptForm && history.length === 0 ? (
          <FadeInView delay={60}>
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="heart-pulse" size={24} color={colors.textMuted} />
              </View>
              <Text className="text-center text-subhead text-muted">
                {t("Rien à afficher pour l'instant : les soins de {name} apparaîtront ici.", { name: horse.name })}
              </Text>
            </View>
          </FadeInView>
        ) : null}

        {!showApptForm && upcoming.length > 0 ? (
          <FadeInView delay={60}>
            <View className="gap-2">
              <Text className="text-footnote font-bold uppercase tracking-wide text-muted" accessibilityRole="header">
                {t("À venir")}
              </Text>
              {upcoming.map(renderAppt)}
            </View>
          </FadeInView>
        ) : null}

        {!showApptForm && past.length > 0 ? (
          <FadeInView delay={80}>
            <View className="gap-2">
              <Text className="text-footnote font-bold uppercase tracking-wide text-muted" accessibilityRole="header">
                {t("Historique")}
              </Text>
              {past.slice(0, visibleCount).map(renderAppt)}
            </View>
          </FadeInView>
        ) : null}
        {!showApptForm && past.length > visibleCount ? (
          <ShowMoreButton
            hidden={past.length - visibleCount}
            label={t("Afficher {v} soins plus anciens", { v: Math.min(past.length - visibleCount, LIST_PAGE_SIZE) })}
            onPress={() => setVisibleCount((n) => n + LIST_PAGE_SIZE)}
          />
        ) : null}

        {/* Antécédents (problèmes de santé + blessures), cf. HealthHistory. */}
        {!showApptForm ? (
          <FadeInView delay={100}>
            <HealthHistory horse={horse} />
          </FadeInView>
        ) : null}

        {/* Export du carnet : action ponctuelle, en bas plutôt qu'avant la
            liste qu'on vient consulter. */}
        {!showApptForm ? (
          <FadeInView delay={120}>
            <TouchableOpacity
              onPress={handleExportRecord}
              activeOpacity={0.8}
              accessibilityRole="button"
              className="flex-row items-center justify-center gap-2 rounded-card border border-border p-4"
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.primary} />
              <Text className="text-subhead font-semibold text-primary">{t("Exporter le carnet de santé (PDF)")}</Text>
            </TouchableOpacity>
          </FadeInView>
        ) : null}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
