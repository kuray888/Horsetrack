import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "@/theme/colors";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import { RecurrenceField } from "@/components/RecurrenceField";
import { HorseMultiSelect } from "@/horses/components/HorseMultiSelect";
import { HorseTargetNotice } from "@/horses/components/HorseTargetNotice";
import { AmountModeField } from "@/agenda/components/AmountModeField";
import {
  MAX_ENTRIES_PER_SUBMIT,
  needsExplicitHorseChoice,
  resolveTargetHorseIds,
  shouldOfferHorseChoice,
} from "@/horses/selectableHorses";
import { computeRecurrenceDates } from "@/lib/recurrence";
import type { ReminderOption } from "@/lib/notifications";
import type { AppointmentType, CompetitionEntry, CompetitionLevel } from "@/agenda/store";
import { defaultInternationalEnd } from "@/planning/eventSpan";
import { APPT_META, HEALTH_APPT_TYPES, REMINDER_META, DISCIPLINE_META } from "@/agenda/meta";
import type { AppointmentFormValue } from "@/agenda/hooks/useAppointmentForm";
import type { Discipline } from "@/onboarding/store";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Formulaire de rendez-vous (création/édition) d'AgendaScreen — JSX extrait
 * tel quel (cf. plan Phase 3 Étape 1), aucun changement de comportement.
 * Bascule elle-même entre le bouton "Ajouter" et le formulaire ouvert, comme
 * le faisait le ternaire d'origine dans AgendaScreen. */
export function AppointmentForm({
  show,
  form,
  setForm,
  editingApptId,
  submitting,
  selectableHorses = [],
  fallbackHorseIds = [],
  targetHorseName = null,
  onOpen,
  onCancel,
  onSubmit,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: {
  show: boolean;
  form: AppointmentFormValue;
  setForm: (updater: (f: AppointmentFormValue) => AppointmentFormValue) => void;
  editingApptId: string | null;
  submitting: boolean;
  /** Chevaux proposables pour créer le même rendez-vous d'un coup. Omis par
   * les écrans déjà cadrés sur un cheval précis (fiche cheval, santé d'un
   * cheval) : le sélecteur n'y apparaît pas, et le rendez-vous part sur le
   * cheval actif comme avant. Doit venir de `useSelectableHorses` (chevaux
   * possédés et non verrouillés), jamais de `horses` brut. */
  selectableHorses?: { id: string; name: string }[];
  /** Chevaux visés tant que rien n'est coché : le cheval actif, ou tous les
   * chevaux proposables en vue « Tous » du Planning. */
  fallbackHorseIds?: string[];
  /** Cheval auquel l'entrée sera rattachée, à rappeler en tête du formulaire
   * (cf. HorseTargetNotice). Omis quand le sélecteur multi-chevaux s'affiche :
   * les cases cochées le disent déjà. */
  targetHorseName?: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onAddEntry: () => void;
  onUpdateEntry: (id: string, patch: Partial<CompetitionEntry>) => void;
  onRemoveEntry: (id: string) => void;
}) {
  if (!show) {
    return <AddToggle label="Ajouter un rendez-vous" onPress={onOpen} color={colors.primary} />;
  }

  const isConcours = form.type === "concours";
  const isInternational = isConcours && form.competitionLevel === "international";
  const offerHorseChoice = !editingApptId && shouldOfferHorseChoice(selectableHorses, fallbackHorseIds);
  // Nombre d'entrées que la soumission va créer : occurrences de récurrence ×
  // chevaux visés. Doit rester le MÊME calcul que handleSubmitAppointment
  // (cf. sa double boucle), sinon le bouton mentirait sur ce qu'il va faire.
  const occurrenceCount =
    form.recurrence.mode === "custom" && form.date ? computeRecurrenceDates(form.date, form.recurrence).length : 1;
  const targetHorseCount =
    editingApptId
      ? 1
      : Math.max(
          1,
          (offerHorseChoice
            ? resolveTargetHorseIds(form.horseIds, selectableHorses, fallbackHorseIds)
            : fallbackHorseIds
          ).length
        );
  const createCount = occurrenceCount * targetHorseCount;
  const overLimit = !editingApptId && createCount > MAX_ENTRIES_PER_SUBMIT;
  // Vue « Tous » du Planning : aucun cheval visé tant que rien n'est coché
  // (cf. needsExplicitHorseChoice). Le bouton le dit avant l'appui plutôt que
  // de laisser buter sur l'alerte de handleSubmitAppointment.
  const missingHorseChoice = !editingApptId && needsExplicitHorseChoice(form.horseIds, selectableHorses, fallbackHorseIds);

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editingApptId ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
      </Text>
      {offerHorseChoice ? null : <HorseTargetNotice horseName={targetHorseName} />}
      <Field label="Type de rendez-vous">
        <ChipSelect
          options={Object.entries(APPT_META).map(([value, meta]) => ({
            value: value as AppointmentType,
            label: meta.label,
            icon: meta.icon,
          }))}
          value={form.type}
          onChange={(type) => setForm((f) => ({ ...f, type }))}
        />
      </Field>
      {offerHorseChoice ? (
        <HorseMultiSelect
          horses={selectableHorses}
          fallbackIds={fallbackHorseIds}
          value={form.horseIds}
          onChange={(horseIds) => setForm((f) => ({ ...f, horseIds }))}
        />
      ) : null}
      <Field label="Titre">
        <TextInput
          className={INPUT}
          placeholder="Ex : Vaccin annuel"
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
        />
      </Field>
      <DatePickerField
        label={isInternational ? "Premier jour" : "Date"}
        value={form.date}
        onChange={(date) =>
          setForm((f) => ({
            ...f,
            date,
            // Un international garde une fin cohérente : si le premier jour
            // dépasse la fin déjà saisie, on la décale au lieu de la laisser
            // avant le début.
            endDate:
              f.type === "concours" && f.competitionLevel === "international" && (!f.endDate || f.endDate <= date)
                ? defaultInternationalEnd(date)
                : f.endDate,
          }))
        }
      />
      {isConcours ? (
        <>
          <Field label="Niveau du concours">
            <ChipSelect
              options={[
                { value: "national" as CompetitionLevel, label: "National", icon: { name: "flag-outline", color: colors.textMuted } },
                { value: "international" as CompetitionLevel, label: "International", icon: { name: "earth", color: colors.textMuted } },
              ]}
              value={form.competitionLevel}
              onChange={(competitionLevel) =>
                setForm((f) => ({
                  ...f,
                  competitionLevel,
                  // Un international dure souvent 4 à 5 jours : on propose 4
                  // jours d'emblée, modifiables. Repasser en national efface la fin.
                  endDate:
                    competitionLevel === "international"
                      ? (f.endDate ?? (f.date ? defaultInternationalEnd(f.date) : null))
                      : null,
                }))
              }
            />
          </Field>
          {isInternational ? (
            <DatePickerField
              label="Dernier jour du concours"
              value={form.endDate}
              onChange={(endDate) => setForm((f) => ({ ...f, endDate }))}
            />
          ) : null}
          {isInternational && form.date && form.endDate && form.endDate <= form.date ? (
            <Text className="text-xs text-danger">
              Le dernier jour doit être après le premier : sinon le concours sera enregistré sur un seul jour.
            </Text>
          ) : null}
        </>
      ) : null}
      <TimePickerField label="Heure" value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} />
      <Field label="Lieu (optionnel)">
        <TextInput
          className={INPUT}
          placeholder="Ex : Clinique équine du Val"
          value={form.location}
          onChangeText={(location) => setForm((f) => ({ ...f, location }))}
        />
      </Field>
      {HEALTH_APPT_TYPES.includes(form.type) ? (
        <>
          <Field label="Professionnel (optionnel)">
            <TextInput
              className={INPUT}
              placeholder="Ex : Dr Martin"
              value={form.professional}
              onChangeText={(professional) => setForm((f) => ({ ...f, professional }))}
            />
          </Field>
          <Field label="Coût (€, optionnel)">
            <TextInput
              className={INPUT}
              placeholder="Ex : 65"
              value={form.cost}
              onChangeText={(cost) => setForm((f) => ({ ...f, cost }))}
              keyboardType="decimal-pad"
            />
          </Field>
          {/* `createCount` et non `targetHorseCount` : la répartition porte sur
              toutes les entrées créées, répétitions comprises (cf.
              handleSubmitAppointment). Avec 3 chevaux répétés 4 fois, l'aperçu
              annonçait sinon « 3 rendez-vous … soit 180 € au total » alors que
              12 rendez-vous étaient créés. */}
          <AmountModeField
            mode={form.costMode}
            onChange={(costMode) => setForm((f) => ({ ...f, costMode }))}
            horseCount={createCount}
            amount={Number(form.cost.replace(",", "."))}
            noun="rendez-vous"
          />
          <DatePickerField
            label="Prochaine échéance (optionnel)"
            value={form.nextDueDate}
            onChange={(nextDueDate) => setForm((f) => ({ ...f, nextDueDate }))}
          />
        </>
      ) : null}
      <Locked message="Rappels automatiques réservés à l'abonnement Premium">
        <Field label="Rappel">
          <ChipSelect
            options={Object.entries(REMINDER_META).map(([value, meta]) => ({
              value: value as ReminderOption,
              label: meta.label,
              icon: meta.icon,
            }))}
            value={form.reminder}
            onChange={(reminder) => setForm((f) => ({ ...f, reminder }))}
          />
        </Field>
      </Locked>
      {!editingApptId && form.type !== "concours" ? (
        <RecurrenceField value={form.recurrence} onChange={(recurrence) => setForm((f) => ({ ...f, recurrence }))} />
      ) : null}
      {form.type === "concours" ? (
        <>
          {targetHorseCount > 1 ? (
            <Text className="text-xs text-muted">
              Le dossard est propre à chaque cheval : renseigne-le ensuite concours par concours (Modifier).
            </Text>
          ) : (
            <Field label="Dossard (optionnel)">
              <TextInput
                className={INPUT}
                placeholder="Ex : 142"
                value={form.dossard}
                onChangeText={(dossard) => setForm((f) => ({ ...f, dossard }))}
                keyboardType="number-pad"
              />
            </Field>
          )}
          {/* Les épreuves d'un concours EXISTANT se gèrent depuis sa carte (ajout,
              résultat, suppression : chacune est une ligne à part côté serveur).
              Les proposer ici les laissait modifiables alors que l'enregistrement
              ne les prend pas en compte — la modification disparaissait en silence. */}
          {editingApptId ? null : (
            <>
              <Locked message="Détail des épreuves réservé à l'abonnement Premium">
                <View className="gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Épreuves</Text>
                  {form.competitionEntries.map((entry) => (
                    <View key={entry.id} className="gap-2 rounded-card border border-border p-3">
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          className={`${INPUT} flex-1`}
                          placeholder="Ex : Épreuve club 2 — 1m10"
                          value={entry.name}
                          onChangeText={(name) => onUpdateEntry(entry.id, { name })}
                        />
                        <TouchableOpacity onPress={() => onRemoveEntry(entry.id)} hitSlop={8} activeOpacity={0.7}>
                          <Text className="text-sm text-muted">✕</Text>
                        </TouchableOpacity>
                      </View>
                      <ChipSelect
                        options={Object.entries(DISCIPLINE_META).map(([value, meta]) => ({
                          value: value as Discipline,
                          label: meta.label,
                          icon: meta.icon,
                        }))}
                        value={entry.discipline}
                        onChange={(discipline) => onUpdateEntry(entry.id, { discipline })}
                      />
                      <TextInput
                        className={INPUT}
                        placeholder="Heure de l'épreuve (ex : 09h15)"
                        value={entry.time}
                        onChangeText={(time) => onUpdateEntry(entry.id, { time })}
                      />
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={onAddEntry}
                    activeOpacity={0.8}
                    className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-3"
                  >
                    <Text className="text-sm font-semibold text-accent">＋ Ajouter une épreuve</Text>
                  </TouchableOpacity>
                </View>
              </Locked>
            </>
          )}
        </>
      ) : null}
      {overLimit ? (
        <Text className="text-xs text-danger">
          {`${createCount} rendez-vous d'un coup, c'est trop (maximum ${MAX_ENTRIES_PER_SUBMIT}) : chacun programme un rappel. Réduis la répétition ou le nombre de chevaux.`}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={onCancel} className="flex-1 items-center rounded-card border border-border p-4">
          <Text className="text-base font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={
              submitting
                ? "Un instant…"
                : editingApptId
                  ? "Enregistrer"
                  : createCount > 1
                    ? `Ajouter (×${createCount})`
                    : "Ajouter"
            }
            disabled={!form.title.trim() || !form.date || submitting || overLimit || missingHorseChoice}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
