import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { Field } from "@/components/Field";
import { usePickerOverlay } from "@/components/PickerOverlay";

export type DropdownOption<T extends string> = { value: T; label: string };

/**
 * Sélecteur compact "menu déroulant" (Field + valeur tappable + calque plein
 * écran, cf. components/PickerOverlay.tsx) — alternative à SingleSelect
 * (grandes cartes) pour les écrans qui empilent beaucoup de champs (cf.
 * horse-basics, horse-profile, horse-health).
 */
export function DropdownField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Sélectionner…",
}: {
  label: string;
  value: T | null;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const { show, hide } = usePickerOverlay();

  useEffect(() => {
    if (!open) {
      hide();
      return;
    }
    show(
      <TouchableOpacity activeOpacity={1} onPress={() => {}} className="max-h-[70%] w-full rounded-card bg-surface p-2">
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                activeOpacity={0.8}
                className={`flex-row items-center justify-between rounded-card p-4 ${isSelected ? "bg-highlight" : ""}`}
              >
                <Text className={`text-base ${isSelected ? "font-bold text-primary" : "text-text"}`}>{opt.label}</Text>
                {isSelected ? <Text className="text-base font-bold text-primary">✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </TouchableOpacity>,
      () => setOpen(false)
    );
  }, [open, options, value, onChange, show, hide]);

  useEffect(() => () => hide(), [hide]);

  return (
    <Field label={label}>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        className="flex-row items-center justify-between rounded-card border border-border bg-surface p-4"
      >
        <Text className={selected ? "text-base text-text" : "text-base text-muted"}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text className="text-base text-muted">▾</Text>
      </TouchableOpacity>
    </Field>
  );
}
