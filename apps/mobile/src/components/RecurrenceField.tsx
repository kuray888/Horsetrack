import { View } from "react-native";
import { Field } from "@/components/Field";
import { ChipSelect } from "@/components/FormChips";
import { DatePickerField } from "@/components/DatePickerField";
import { colors } from "@/theme/colors";
import {
  defaultCustomRecurrence,
  NEVER_RECURRENCE,
  type Recurrence,
  type RecurrenceIntervalWeeks,
} from "@/lib/recurrence";
import { t } from "@/i18n";

const INTERVAL_OPTIONS: { value: RecurrenceIntervalWeeks; label: string }[] = [
  { value: 1, label: t("1 semaine") },
  { value: 2, label: t("2 semaines") },
  { value: 3, label: t("3 semaines") },
  { value: 4, label: t("4 semaines") },
];

const MIN_OCCURRENCES = 2;
const MAX_OCCURRENCES = 12;
const OCCURRENCE_OPTIONS = Array.from(
  { length: MAX_OCCURRENCES - MIN_OCCURRENCES + 1 },
  (_, i) => i + MIN_OCCURRENCES
);

const DEFAULT_END_DATE = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};

/**
 * "Répéter ?" (Jamais / Personnalisé), et si Personnalisé : intervalle en
 * semaines + fin (nombre d'occurrences ou date) — cf. src/lib/recurrence.ts
 * pour le calcul des dates. Partagé entre le formulaire de séance
 * (planning.tsx) et le formulaire de rendez-vous (AppointmentForm), pour ne
 * pas dupliquer cette UI (cf. audit Phase 8, tranche E).
 */
export function RecurrenceField({ value, onChange }: { value: Recurrence; onChange: (r: Recurrence) => void }) {
  return (
    <View className="gap-3">
      <Field label={t("Répéter ?")}>
        <ChipSelect
          options={[
            { value: "never", label: t("Jamais"), icon: { name: "close" as const, color: colors.textMuted } },
            { value: "custom", label: t("Personnalisé"), icon: { name: "repeat" as const, color: colors.textMuted } },
          ]}
          value={value.mode}
          onChange={(mode) => onChange(mode === "never" ? NEVER_RECURRENCE : defaultCustomRecurrence())}
        />
      </Field>
      {value.mode === "custom" ? (
        <>
          <Field label={t("Toutes les")}>
            <ChipSelect
              options={INTERVAL_OPTIONS.map((opt) => ({
                value: String(opt.value),
                label: opt.label,
                icon: { name: "calendar-clock-outline" as const, color: colors.textMuted },
              }))}
              value={String(value.intervalWeeks)}
              onChange={(v) =>
                onChange({ ...value, intervalWeeks: Number(v) as RecurrenceIntervalWeeks })
              }
            />
          </Field>
          <Field label={t("Fin")}>
            <ChipSelect
              options={[
                { value: "count", label: t("Nombre d'occurrences"), icon: { name: "repeat" as const, color: colors.textMuted } },
                { value: "date", label: t("À une date"), icon: { name: "calendar-clock-outline" as const, color: colors.textMuted } },
              ]}
              value={value.end.type}
              onChange={(type) =>
                onChange({
                  ...value,
                  end:
                    type === "count"
                      ? { type: "count", occurrences: 4 }
                      : { type: "date", date: DEFAULT_END_DATE() },
                })
              }
            />
          </Field>
          {value.end.type === "count" ? (
            <Field label={t("{occurrences} occurrences au total", { occurrences: value.end.occurrences })}>
              <ChipSelect
                options={OCCURRENCE_OPTIONS.map((n) => ({
                  value: String(n),
                  label: String(n),
                  icon: { name: "repeat" as const, color: colors.textMuted },
                }))}
                value={String(value.end.occurrences)}
                onChange={(v) => onChange({ ...value, end: { type: "count", occurrences: Number(v) } })}
              />
            </Field>
          ) : (
            <DatePickerField
              label={t("Dernière occurrence au plus tard le")}
              value={value.end.date}
              onChange={(date) => onChange({ ...value, end: { type: "date", date } })}
            />
          )}
        </>
      ) : null}
    </View>
  );
}
