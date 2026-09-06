import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { useAgenda, daysFromNow, type Appointment } from "@/agenda/store";
import { APPT_META, HEALTH_APPT_TYPES, daysUntilLabel } from "@/agenda/meta";
import { formatDate } from "@/lib/dateFormat";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";

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
  const { horses, selectedHorse, selectHorse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useAgenda();

  const horse = horses.find((h) => h.id === id);

  // Même garantie que le Horse Hub : consulter cet écran rend ce cheval actif,
  // pas de double sélection si l'utilisateur veut ensuite agir dessus
  // (Quick Add, formulaire ci-dessous...).
  useEffect(() => {
    if (horse && selectedHorse?.id !== horse.id) selectHorse(horse.id);
  }, [horse, selectedHorse?.id, selectHorse]);

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

  function statusFor(appt: Appointment): { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string } {
    if (appt.date <= today) return { label: "Effectué", icon: "check-circle-outline", color: colors.success };
    return { label: `À venir · ${daysUntilLabel(appt.date)}`, icon: "clock-outline", color: colors.warning };
  }

  // Même confirmation que Planning/Agenda pour un rendez-vous (cf.
  // agenda.tsx confirmDelete) — cet écran n'exposait jusqu'ici aucune
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
            onOpen={startAddAppt}
            onCancel={cancelApptForm}
            onSubmit={handleSubmitAppointment}
            onAddEntry={addApptFormEntry}
            onUpdateEntry={updateApptFormEntry}
            onRemoveEntry={removeApptFormEntry}
          />
        </FadeInView>

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
