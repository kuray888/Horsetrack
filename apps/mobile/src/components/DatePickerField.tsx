import { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Field } from "@/components/Field";
import { usePickerOverlay } from "@/components/PickerOverlay";
import { MONTHS, DAY_LABELS, formatDate } from "@/lib/dateFormat";

/**
 * Mini calendrier maison (calque plein écran + grille de jours, cf.
 * components/PickerOverlay.tsx), sans dépendance native —
 * @react-native-community/datetimepicker a des rapports d'incompatibilité
 * avec Expo Go sur certaines versions de SDK, donc on évite ce risque ici.
 */
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function isSameDay(a: Date, y: number, m: number, d: number): boolean {
  return a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;
}

export function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((value ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState((value ?? new Date()).getMonth());
  const { show, hide } = usePickerOverlay();

  function openPicker() {
    const base = value ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  }

  const changeMonth = useCallback(
    (delta: number) => {
      let m = viewMonth + delta;
      let y = viewYear;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      setViewMonth(m);
      setViewYear(y);
    },
    [viewMonth, viewYear]
  );

  useEffect(() => {
    if (!open) {
      hide();
      return;
    }
    const grid = buildMonthGrid(viewYear, viewMonth);
    const today = new Date();
    show(
      <TouchableOpacity activeOpacity={1} onPress={() => {}} className="w-full rounded-card bg-surface p-5">
        <View className="mb-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={8}>
            <Text className="text-xl font-bold text-primary">‹</Text>
          </TouchableOpacity>
          <Text className="text-base font-bold text-text">
            {MONTHS[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={8}>
            <Text className="text-xl font-bold text-primary">›</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-1 flex-row justify-between">
          {DAY_LABELS.map((d, i) => (
            <Text key={i} className="w-9 text-center text-xs font-semibold text-muted">
              {d}
            </Text>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {grid.map((day, i) => {
            const selected = day !== null && value !== null && isSameDay(value, viewYear, viewMonth, day);
            const isToday = day !== null && isSameDay(today, viewYear, viewMonth, day);
            return (
              <View key={i} className="h-10 w-[14.28%] items-center justify-center">
                {day !== null ? (
                  <TouchableOpacity
                    onPress={() => {
                      onChange(new Date(viewYear, viewMonth, day));
                      setOpen(false);
                    }}
                    activeOpacity={0.8}
                    className={`h-9 w-9 items-center justify-center rounded-full ${
                      selected ? "bg-primary" : isToday ? "border border-primary" : ""
                    }`}
                  >
                    <Text className={`text-sm ${selected ? "font-bold text-on-primary" : "text-text"}`}>{day}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      </TouchableOpacity>,
      () => setOpen(false)
    );
  }, [open, viewYear, viewMonth, value, changeMonth, onChange, show, hide]);

  // Filet de sécurité si le champ est démonté pendant que le calque est ouvert
  // (ex: navigation en arrière) — sinon le calque resterait affiché, accroché
  // au-dessus de l'écran suivant.
  useEffect(() => () => hide(), [hide]);

  return (
    <Field label={label}>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.8}
        className="rounded-card border border-border bg-surface p-4"
      >
        <Text className={value ? "text-base text-text" : "text-base text-muted"}>
          {value ? formatDate(value) : "Sélectionner une date"}
        </Text>
      </TouchableOpacity>
    </Field>
  );
}
