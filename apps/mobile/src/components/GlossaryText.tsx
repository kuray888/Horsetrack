import { Pressable, Text, View } from "react-native";
import { useGlossary } from "@/glossary/GlossaryProvider";

type Props = { text: string; className?: string };

const BOLD_TERM_PATTERN = /\*\*(.+?)\*\*/g;

function parseSegments(text: string): { content: string; isTerm: boolean }[] {
  const parts: { content: string; isTerm: boolean }[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(BOLD_TERM_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ content: text.slice(lastIndex, index), isTerm: false });
    parts.push({ content: match[1], isTerm: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ content: text.slice(lastIndex), isTerm: false });
  return parts;
}

/** Affiche `text` en mettant en gras les `**terme**`, et ajoute une rangée de
 * pastilles tappables sous le texte pour consulter leur définition. Le mot en
 * gras lui-même n'est pas tappable : une zone tactile imbriquée dans un
 * `<Text>` qui passe à la ligne n'est pas fiable sur Android — une pastille
 * séparée est un vrai bouton, donc toujours cliquable. */
export function GlossaryText({ text, className }: Props) {
  const { showTerm } = useGlossary();
  const segments = parseSegments(text);
  const terms = Array.from(new Set(segments.filter((s) => s.isTerm).map((s) => s.content)));

  return (
    <View>
      <Text className={className}>
        {segments.map((seg, i) =>
          seg.isTerm ? (
            <Text key={i} className="font-bold text-accent">
              {seg.content}
            </Text>
          ) : (
            <Text key={i}>{seg.content}</Text>
          )
        )}
      </Text>
      {terms.length > 0 ? (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {terms.map((term) => (
            <Pressable
              key={term}
              onPress={() => showTerm(term)}
              hitSlop={6}
              className="rounded-full bg-highlight px-2.5 py-1"
            >
              <Text className="text-xs font-semibold text-accent">ℹ️ {term}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
