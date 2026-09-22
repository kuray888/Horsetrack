import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useWeight } from "@/horses/weightStore";
import { exportHealthRecord } from "@/horses/exportHealthRecord";
import { useSubscription } from "@/subscription/store";
import { useAgenda, daysFromNow, type Appointment } from "@/agenda/store";
import { APPT_META, HEALTH_APPT_TYPES, daysUntilLabel } from "@/agenda/meta";
import { formatDate } from "@/lib/dateFormat";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { HealthHistory } from "@/horses/components/HealthHistory";

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
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useAgenda();
  const { measurements } = useWeight();

  const horse = horses.find((h) => h.id === id);

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

  if (!horse) {
    return (
      <Screen>
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">Ce cheval est introuvable.</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  const today = daysFromNow(0);
  const history = appointments
    .filter((a) => a.horseId === horse.id && (HEALTH_APPT_TYPES as readonly string[]).includes(a.type))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

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
    if (appt.date <= today) return { label: "Effectué", icon: "check-circle-outline", color: colors.success };
    return { label: `À venir · ${daysUntilLabel(appt.date)}`, icon: "clock-outline", color: colors.warning };
  }

  // Même confirmation que Planning/Agenda pour un rendez-vous (cf.
  // même formulation que partout ailleurs) — cet écran n'exposait aucune
  // suppression : la liste ne faisait que rouvrir l'édition (startEditAppt),
  // et AppointmentForm n'a pas de bouton "Supprimer" (contrairement aux
  // cartes d'Agenda/Planning). deleteAppointment existe déjà et gère tout
  // (annule les rappels programmés, sync cloud) — rien à ajouter côté store.
  function confirmDeleteAppt(appt: Appointment) {
    Alert.alert("Supprimer ce rendez-vous ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteAppointment(appt) },
    ]);
  }

  function startAddAppt() {
    // Pré-sélectionne un type de soin (cf. HEALTH_APPT_TYPES) plutôt que le
    // premier type de l'énumération complète (qui inclut concours/autre, hors
    // sujet sur cet écran) — l'utilisateur garde la main pour changer le type
    // dans le sélecteur du formulaire.
    setApptForm((f) => ({ ...f, type: "veto" }));
    setShowApptForm(true);
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-display tracking-tight text-text">Santé</Text>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        <FadeInView delay={40}>
          <AppointmentForm
            show={showApptForm}
            form={apptForm}
            setForm={setApptForm}
            editingApptId={editingApptId}
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

        {/* Export du carnet — masqué pendant la saisie, comme le reste : on
            n'exporte pas un carnet au milieu d'un ajout. */}
        {!showApptForm ? (
          <FadeInView delay={45}>
            <TouchableOpacity
              onPress={handleExportRecord}
              activeOpacity={0.8}
              accessibilityRole="button"
              className="flex-row items-center justify-center gap-2 rounded-card border border-border p-3.5"
            >
              <MaterialCommunityIcons name="file-pdf-box" size={18} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Exporter le carnet de santé (PDF)</Text>
            </TouchableOpacity>
          </FadeInView>
        ) : null}

        {/* Antécédents (problèmes de santé + blessures), cf. HealthHistory : masqués
            pendant la saisie d'un rendez-vous, comme la liste des soins. */}
        {!showApptForm ? (
          <FadeInView delay={50}>
            <HealthHistory horse={horse} />
          </FadeInView>
        ) : null}

        {!showApptForm ? (
          <FadeInView delay={55}>
            <Text className="mt-1 text-sm font-bold uppercase tracking-wide text-muted">Soins et rendez-vous</Text>
          </FadeInView>
        ) : null}

        {!showApptForm && history.length === 0 ? (
          <FadeInView delay={60}>
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="heart-pulse" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-sm text-muted">
                Rien à afficher pour l&apos;instant : les soins de {horse.name} apparaîtront ici.
              </Text>
            </View>
          </FadeInView>
        ) : !showApptForm ? (
          <FadeInView delay={60}>
            <View className="gap-2">
              {history.map((appt) => {
                const meta = APPT_META[appt.type];
                const status = statusFor(appt);
                // "jusqu'au [prochaine échéance]" pour un traitement en cours
                // (durée), simple ligne "Prochaine échéance" pour les autres
                // types (vaccin, vermifuge...) — même champ nextDueDate déjà
                // existant, pas de nouvelle donnée.
                const isTreatmentRange = appt.type === "traitement" && appt.nextDueDate;
                return (
                  <TouchableOpacity
                    key={appt.id}
                    onPress={() => startEditAppt(appt)}
                    activeOpacity={0.8}
                    className={`${CARD} flex-row items-center gap-3`}
                  >
                    <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
                      <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-base font-bold text-text">{meta.label}</Text>
                      <Text className="text-sm text-muted">
                        {isTreatmentRange
                          ? `${formatDate(appt.date)} → ${formatDate(appt.nextDueDate!)}`
                          : formatDate(appt.date)}
                        {appt.professional ? ` · ${appt.professional}` : ""}
                      </Text>
                      {!isTreatmentRange && appt.nextDueDate ? (
                        <Text className="text-xs text-accent">
                          Prochaine échéance : {formatDate(appt.nextDueDate)}
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end gap-1">
                      <View className="flex-row items-center gap-1">
                        <MaterialCommunityIcons name={status.icon} size={14} color={status.color} />
                        <Text className="text-xs font-semibold" style={{ color: status.color }}>
                          {status.label}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <Text className="text-xs font-semibold text-accent">Modifier</Text>
                        <TouchableOpacity
                          onPress={() => confirmDeleteAppt(appt)}
                          hitSlop={8}
                          activeOpacity={0.7}
                          accessibilityLabel="Supprimer ce rendez-vous"
                          accessibilityRole="button"
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FadeInView>
        ) : null}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
