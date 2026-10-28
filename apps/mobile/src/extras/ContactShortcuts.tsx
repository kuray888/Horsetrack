import { ScrollView, Text, TouchableOpacity } from "react-native";
import { useContacts } from "@/extras/store";
import { suggestedContacts } from "@/extras/model";

/** Puces « choisir dans mes contacts » sous le champ Professionnel. Rien
 * s'il n'y a aucun contact : le champ reste un simple texte libre. */
export function ContactShortcuts({
  type,
  selected,
  onPick,
}: {
  type: string;
  selected: string;
  onPick: (name: string) => void;
}) {
  const contacts = suggestedContacts(useContacts(), type).slice(0, 8);
  if (contacts.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pt-1">
      {contacts.map((c) => {
        const active = selected.trim() === c.name;
        return (
          <TouchableOpacity
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onPick(c.name)}
            className={`rounded-full border px-3 py-1.5 ${active ? "border-primary bg-highlight" : "border-border bg-surface"}`}
          >
            <Text className={`text-sm font-semibold ${active ? "text-primary" : "text-text"}`}>{c.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
