import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Field } from "@/components/Field";
import { usePickerOverlay } from "@/components/PickerOverlay";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function parseValue(value: string): { hour: number; minute: number } {
  const match = value.match(/(\d{1,2})\s*h\s*(\d{1,2})?/i);
  if (!match) return { hour: 9, minute: 0 };
  return {
    hour: Math.min(23, parseInt(match[1], 10)),
    minute: match[2] ? Math.min(59, parseInt(match[2], 10)) : 0,
  };
}

function format(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
}

/** Sélecteur d'heure maison (calque plein écran + 2 colonnes défilantes, cf.
 * components/PickerOverlay.tsx), sans dépendance native. */
export function TimePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => parseValue(value).hour);
  const [minute, setMinute] = useState(() => parseValue(value).minute);
  const { show, hide } = usePickerOverlay();

  function openPicker() {
    const parsed = parseValue(value);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      hide();
      return;
    }
    show(
      <TouchableOpacity activeOpacity={1} onPress={() => {}} className="w-full gap-4 rounded-card bg-surface p-5">
        <Text className="text-center text-2xl font-extrabold text-text">{format(hour, minute)}</Text>
        <View className="flex-row gap-3" style={{ height: 160 }}>
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {HOURS.map((h) => (
              <TouchableOpacity
                key={h}
                onPress={() => setHour(h)}
                activeOpacity={0.8}
                className={`items-center rounded-card py-2 ${h === hour ? "bg-highlight" : ""}`}
              >
                <Text className={`text-base ${h === hour ? "font-bold text-primary" : "text-text"}`}>
                  {String(h).padStart(2, "0")} h
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {MINUTES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMinute(m)}
                activeOpacity={0.8}
                className={`items-center rounded-card py-2 ${m === minute ? "bg-highlight" : ""}`}
              >
                <Text className={`text-base ${m === minute ? "font-bold text-primary" : "text-text"}`}>
                  {String(m).padStart(2, "0")} min
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity
          onPress={() => {
            onChange(format(hour, minute));
            setOpen(false);
          }}
          activeOpacity={0.85}
          className="items-center rounded-card bg-primary p-4"
        >
          <Text className="text-base font-bold text-on-primary">Valider</Text>
        </TouchableOpacity>
      </TouchableOpacity>,
      () => setOpen(false)
    );
  }, [open, hour, minute, onChange, show, hide]);

  useEffect(() => () => hide(), [hide]);

  return (
    <Field label={label}>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.8}
        className="rounded-card border border-border bg-surface p-4"
      >
        <Text className={value ? "text-base text-text" : "text-base text-muted"}>
          {value || "Sélectionner une heure"}
        </Text>
      </TouchableOpacity>
    </Field>
  );
}
