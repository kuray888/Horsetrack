import { Text, TouchableOpacity, View } from "react-native";

export type AgendaSection = "appointments" | "documents" | "journal" | "finances";

const SECTIONS: { value: AgendaSection; label: string }[] = [
  { value: "appointments", label: "Rendez-vous" },
  { value: "documents", label: "Documents" },
  { value: "journal", label: "Journal" },
  { value: "finances", label: "Finances" },
];

/** Valeurs valides d'AgendaSection — utilisé par AgendaScreen pour valider
 * un `?section=` de route (cf. app/horse/[id]/*.tsx) avant de s'en servir
 * comme état initial. */
export const AGENDA_SECTIONS: AgendaSection[] = SECTIONS.map((s) => s.value);

/** Sélecteur de section en pilules d'AgendaScreen (Rendez-vous / Documents /
 * Journal / Finances) — JSX extrait tel quel (cf. plan Phase 3 Étape 1),
 * aucun changement de comportement. Pure présentation/navigation : ne
 * connaît rien des données ou de la logique propres à chaque section. */
export function SectionSwitcher({ section, onChange }: { section: AgendaSection; onChange: (section: AgendaSection) => void }) {
  return (
    <View className="flex-row gap-2 rounded-full bg-surface p-1.5 shadow-card">
      {SECTIONS.map(({ value, label }) => (
        <TouchableOpacity
          key={value}
          onPress={() => onChange(value)}
          activeOpacity={0.85}
          className={`flex-1 items-center rounded-full px-1.5 py-2.5 ${section === value ? "bg-primary" : ""}`}
        >
          <Text
            numberOfLines={1}
            className={`text-sm font-bold ${section === value ? "text-on-primary" : "text-muted"}`}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
