import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Field } from "@/components/Field";
import { usePickerOverlay } from "@/components/PickerOverlay";
import { colors } from "@/theme/colors";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  icon?: { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };
};

/**
 * Sélecteur compact "menu déroulant" (Field + valeur tappable + calque plein
 * écran, cf. components/PickerOverlay.tsx) — alternative à SingleSelect
 * (grandes cartes) pour les écrans qui empilent beaucoup de champs (cf.
 * horse-basics.tsx, HorseForm.tsx).
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
                accessibilityLabel={opt.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`flex-row items-center gap-3 rounded-card p-4 ${isSelected ? "bg-highlight" : ""}`}
              >
                {opt.icon ? (
                  <MaterialCommunityIcons name={opt.icon.name} size={17} color={opt.icon.color} accessibilityElementsHidden />
                ) : null}
                <Text className={`flex-1 text-base ${isSelected ? "font-bold text-primary" : "text-text"}`}>{opt.label}</Text>
                {isSelected ? (
                  <MaterialCommunityIcons name="check" size={18} color={colors.primary} accessibilityElementsHidden />
                ) : null}
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
        accessibilityLabel={selected ? selected.label : placeholder}
        accessibilityRole="button"
        className="flex-row items-center gap-2 rounded-card border border-border bg-surface p-4"
      >
        {selected?.icon ? (
          <MaterialCommunityIcons name={selected.icon.name} size={17} color={selected.icon.color} accessibilityElementsHidden />
        ) : null}
        <Text className={`flex-1 ${selected ? "text-base text-text" : "text-base text-muted"}`}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textMuted} accessibilityElementsHidden />
      </TouchableOpacity>
    </Field>
  );
}
