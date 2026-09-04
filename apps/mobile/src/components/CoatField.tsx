import { TextInput } from "react-native";
import { DropdownField } from "@/components/DropdownField";
import { HORSE_COATS, OTHER_OPTION } from "@/onboarding/options";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const KNOWN_COATS = HORSE_COATS.map((c) => c.value);

/** Dropdown de robes courantes + champ libre si "Autre" — même pattern que
 * BreedField, utilisé partout où on saisit un cheval. */
export function CoatField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (coat: string | null) => void;
}) {
  const selection = value === null ? null : KNOWN_COATS.includes(value) ? value : OTHER_OPTION;

  return (
    <>
      <DropdownField
        label="Robe (optionnel)"
        options={HORSE_COATS}
        value={selection}
        onChange={(v) => onChange(v === OTHER_OPTION ? "" : v)}
        placeholder="Sélectionner une robe"
      />
      {selection === OTHER_OPTION ? (
        <TextInput
          className={INPUT}
          placeholder="Précise la robe"
          value={value ?? ""}
          onChangeText={onChange}
          autoCapitalize="words"
        />
      ) : null}
    </>
  );
}
