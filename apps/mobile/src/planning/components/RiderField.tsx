import { TextInput } from "react-native";
import { Field } from "@/components/Field";
import { ChipSelect } from "@/components/FormChips";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { TeamMember } from "@/planning/riders";
import { t } from "@/i18n";

const NONE = "__none";
const OTHER = "__other";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export type RiderValue = { riderUserId: string | null; riderName: string; riderOther: boolean };

/**
 * « Qui monte ? » : un membre de l'équipe du cheval, quelqu'un sans compte
 * (simple nom, pour le coach, le gérant ou le propriétaire), ou personne en
 * particulier. Les membres proposés viennent de planning/riders.ts
 * assignableRiders.
 */
export function RiderField({
  members,
  me,
  allowOther,
  value,
  onChange,
}: {
  members: TeamMember[];
  me: string | null;
  allowOther: boolean;
  value: RiderValue;
  onChange: (value: RiderValue) => void;
}) {
  const colors = useThemeColors();
  const options = [
    { value: NONE, label: t("Pas attribuée"), icon: "account-question-outline" },
    ...members.map((m) => ({
      value: m.userId,
      label: m.userId === me ? t("Moi") : m.name,
      icon: "account-outline",
    })),
    ...(allowOther ? [{ value: OTHER, label: t("Quelqu'un d'autre"), icon: "account-plus-outline" }] : []),
  ];
  const selected = value.riderUserId ?? (value.riderOther ? OTHER : NONE);
  return (
    <Field label={t("Qui monte ?")}>
      <ChipSelect
        options={options}
        value={selected}
        onChange={(v) => {
          hapticSelection();
          if (v === NONE) onChange({ riderUserId: null, riderName: "", riderOther: false });
          else if (v === OTHER) onChange({ riderUserId: null, riderName: value.riderName, riderOther: true });
          else onChange({ riderUserId: v, riderName: "", riderOther: false });
        }}
      />
      {selected === OTHER ? (
        <TextInput
          className={INPUT}
          placeholder={t("Son prénom (sans compte Horsetrack)")}
          placeholderTextColor={colors.textMuted}
          value={value.riderName}
          onChangeText={(riderName) => onChange({ ...value, riderName })}
          maxLength={60}
          accessibilityLabel={t("Prénom du cavalier")}
        />
      ) : null}
    </Field>
  );
}
