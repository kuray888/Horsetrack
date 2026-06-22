import { TextInput } from "react-native";
import { DropdownField } from "@/components/DropdownField";
import { HORSE_BREEDS, OTHER_OPTION } from "@/onboarding/options";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const KNOWN_BREEDS = HORSE_BREEDS.map((b) => b.value);

/** Dropdown de races courantes + champ libre si "Autre" — utilisé partout où on saisit un cheval. */
export function BreedField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (breed: string | null) => void;
}) {
  const selection = value === null ? null : KNOWN_BREEDS.includes(value) ? value : OTHER_OPTION;

  return (
    <>
      <DropdownField
        label="Race (optionnel)"
        options={HORSE_BREEDS}
        value={selection}
        onChange={(v) => onChange(v === OTHER_OPTION ? "" : v)}
        placeholder="Sélectionner une race"
      />
      {selection === OTHER_OPTION ? (
        <TextInput
          className={INPUT}
          placeholder="Précise la race"
          value={value ?? ""}
          onChangeText={onChange}
          autoCapitalize="words"
        />
      ) : null}
    </>
  );
}
