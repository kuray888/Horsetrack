import { useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { colors } from "@/theme/colors";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { APPT_META, DOC_META, EXPENSE_META, formatAmount } from "@/agenda/meta";
import { formatDate } from "@/lib/dateFormat";
import { MIN_QUERY_LENGTH, searchEntries, type SearchKind, type SearchResult } from "@/search/search";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Où mène un résultat, et sous quelle apparence. Chaque type garde l'icône
 * et la couleur qu'il a déjà dans le reste de l'app — un résultat de
 * recherche doit ressembler à ce qu'on retrouvera en y allant. */
const KIND_META: Record<SearchKind, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  session: { label: "Séance", icon: "horse-variant" },
  appointment: { label: "Rendez-vous", icon: "calendar-blank-outline" },
  journal: { label: "Journal", icon: "notebook-outline" },
  expense: { label: "Dépense", icon: "wallet-outline" },
  document: { label: "Document", icon: "folder-outline" },
};

/**
 * Recherche transversale — séances, rendez-vous, journal, dépenses,
 * documents, tous chevaux confondus.
 *
 * Jusqu'ici, retrouver « le vaccin de l'an dernier » ou « la facture du
 * maréchal d'août » demandait de parcourir cinq listes à la main, chacune
 * cadrée sur un cheval. La règle de correspondance vit dans search/search.ts
 * (pure et testée) ; cet écran ne fait que rassembler les entrées et les
 * afficher.
 *
 * Chaque résultat ramène à l'endroit où l'entrée vit vraiment, plutôt que
 * d'en proposer une copie modifiable ici : une seule maison par donnée.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const { appointments, journal, expenses, documents } = useAgenda();

  // Toutes les entrées, mises à plat une seule fois par changement de
  // données — pas à chaque frappe (cf. audit perf du 2026-09-09).
  const entries = useMemo<SearchResult[]>(() => {
    const all: SearchResult[] = [];
    for (const s of sessions) {
      all.push({
        kind: "session",
        id: s.id,
        title: s.customActivityLabel || ACTIVITY_META[s.activityType].label,
        subtitle: s.notes,
        date: s.date,
        horseId: s.horseId,
      });
    }
    for (const a of appointments) {
      all.push({
        kind: "appointment",
        id: a.id,
        title: a.title || APPT_META[a.type].label,
        // Le professionnel et le lieu sont ce qu'on retient d'un rendez-vous
        // quand on a oublié son intitulé (« la clinique du Val »).
        subtitle: [APPT_META[a.type].label, a.professional, a.location, a.notes].filter(Boolean).join(" "),
        date: a.date,
        horseId: a.horseId,
      });
    }
    for (const j of journal) {
      all.push({
        kind: "journal",
        id: j.id,
        title: ACTIVITY_META[j.activityType].label,
        subtitle: j.notes,
        date: j.date,
        horseId: j.horseId,
      });
    }
    for (const e of expenses) {
      all.push({
        kind: "expense",
        id: e.id,
        title: EXPENSE_META[e.category].label,
        subtitle: [formatAmount(e.amount, e.currency), e.notes].filter(Boolean).join(" "),
        date: e.date,
        horseId: e.horseId,
      });
    }
    for (const d of documents) {
      all.push({
        kind: "document",
        id: d.id,
        title: d.name,
        subtitle: DOC_META[d.category].label,
        date: d.date,
        horseId: d.horseId,
      });
    }
    return all;
  }, [sessions, appointments, journal, expenses, documents]);

  const results = useMemo(() => searchEntries(entries, query).slice(0, 40), [entries, query]);
  const searching = query.trim().length >= MIN_QUERY_LENGTH;

  /** Ramène à l'endroit où l'entrée vit. Les dépenses et documents vivent
   * dans la fiche de leur cheval ; sans cheval rattaché (entrée ancienne),
   * on ne peut pas y aller — on laisse alors le résultat non cliquable
   * plutôt que d'ouvrir un écran au hasard. */
  function destinationFor(result: SearchResult): (() => void) | null {
    switch (result.kind) {
      case "session":
        return () => router.push("/(tabs)/planning?filter=session");
      case "appointment":
        return () => router.push("/(tabs)/planning");
      case "journal":
        return () => router.push(result.horseId ? `/(tabs)/journal?horse=${result.horseId}` : "/(tabs)/journal");
      case "expense":
        return result.horseId ? () => router.push(`/horse/${result.horseId}/budget`) : null;
      case "document":
        return result.horseId ? () => router.push(`/horse/${result.horseId}/documents`) : null;
    }
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-display tracking-tight text-text">Rechercher</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={40}>
        <TextInput
          className={INPUT}
          placeholder="Vaccin, maréchal, facture, une note…"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </FadeInView>

      {!searching ? (
        <FadeInView delay={80}>
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-center text-sm text-muted">
              Cherche dans les séances, rendez-vous, entrées de journal, dépenses et documents — de tous tes chevaux.
            </Text>
          </View>
        </FadeInView>
      ) : results.length === 0 ? (
        <FadeInView delay={80}>
          <View className={`${CARD} items-center gap-2`}>
            <Text className="text-center text-sm text-muted">
              Rien ne correspond à « {query.trim()} ». Essaie un mot plus court, ou le nom du professionnel.
            </Text>
          </View>
        </FadeInView>
      ) : (
        results.map((result, i) => {
          const meta = KIND_META[result.kind];
          const horseName = horses.find((h) => h.id === result.horseId)?.name ?? null;
          const go = destinationFor(result);
          return (
            <FadeInView key={`${result.kind}-${result.id}`} delay={80 + Math.min(i, 8) * 30}>
              <TouchableOpacity
                onPress={() => go?.()}
                disabled={!go}
                activeOpacity={0.7}
                className={`${CARD} flex-row items-center gap-3`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                  <MaterialCommunityIcons name={meta.icon} size={18} color={colors.primary} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold text-text" numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text className="text-sm text-muted" numberOfLines={1}>
                    {[meta.label, horseName, formatDate(result.date)].filter(Boolean).join(" · ")}
                  </Text>
                  {result.subtitle.trim() ? (
                    <Text className="text-sm text-muted" numberOfLines={1}>
                      {result.subtitle.trim()}
                    </Text>
                  ) : null}
                </View>
                {go ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} /> : null}
              </TouchableOpacity>
            </FadeInView>
          );
        })
      )}
    </Screen>
  );
}
