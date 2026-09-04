import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useAgenda } from "@/agenda/store";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";
import { JournalCard } from "@/agenda/components/JournalCard";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Journal global (cf. plan Phase 3 Étape 5) — même formulaire/carte que
 * l'ancien onglet Journal de l'Agenda (`useJournalForm`/`JournalForm`/
 * `JournalCard`, réutilisés tels quels), mais montre les entrées de tous les
 * chevaux avec un filtre. La création suit le filtre quand il cible un
 * cheval précis (cf. `addJournalEntry`'s `horseId` optionnel dans
 * agenda/store.tsx — un seul mécanisme, pas de deuxième source de vérité :
 * override explicite si le filtre est posé, sinon même fallback qu'avant sur
 * le cheval globalement sélectionné). */
export default function JournalScreen() {
  const colors = useThemeColors();
  const { horses, selectedHorse } = useHorses();
  const { journal, addJournalEntry, updateJournalEntry, deleteJournalEntry } = useAgenda();
  // Filtre initial optionnel (cf. app/horse/[id]/journal.tsx, qui renvoie ici
  // avec ?horse=<id> pour pré-filtrer sur ce cheval) — absent par défaut.
  const { horse: horseParam } = useLocalSearchParams<{ horse?: string }>();
  const [filterHorseId, setFilterHorseId] = useState<string | null>(horseParam ?? null);
  // Journal reste monté entre deux visites (comportement par défaut des Tabs
  // Expo Router) : sans cet ajustement, une deuxième navigation ici avec un
  // ?horse= différent (ex: Horse Hub > Journal d'un autre cheval) ne
  // changerait rien, `useState(horseParam ?? null)` ne s'exécutant qu'au
  // premier montage. Pattern "ajuster l'état pendant le rendu" plutôt qu'un
  // useEffect (cf. react.dev/learn/you-might-not-need-an-effect). Ne touche
  // rien si le paramètre est absent ou ne correspond à aucun cheval, pour ne
  // pas écraser le filtre choisi par l'utilisateur.
  const [syncedHorseParam, setSyncedHorseParam] = useState(horseParam);
  if (horseParam !== syncedHorseParam) {
    setSyncedHorseParam(horseParam);
    if (horseParam && horses.some((h) => h.id === horseParam)) {
      setFilterHorseId(horseParam);
    }
  }
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filterHorse = filterHorseId ? horses.find((h) => h.id === filterHorseId) ?? null : null;
  // Cheval qui recevra la prochaine entrée créée depuis cet écran : celui du
  // filtre s'il cible un cheval précis, sinon le cheval actif global — même
  // logique que partout ailleurs dans l'app, jamais une sélection propre à
  // cet écran.
  const targetHorse = filterHorse ?? selectedHorse;

  const {
    showJournalForm,
    setShowJournalForm,
    journalForm,
    setJournalForm,
    savingJournal,
    editingJournalId,
    startEditJournal,
    cancelJournalForm,
    handleSubmitJournalEntry,
  } = useJournalForm({
    addJournalEntry: (entry) => addJournalEntry(filterHorseId ? { ...entry, horseId: filterHorseId } : entry),
    updateJournalEntry,
    onEditStart: () => setExpandedId(null),
  });

  const filtered = filterHorseId ? journal.filter((j) => j.horseId === filterHorseId) : journal;
  const sortedJournal = [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());

  function horseName(horseId: string | null): string {
    return horses.find((h) => h.id === horseId)?.name ?? "?";
  }

  return (
    <>
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-3xl font-display tracking-tight text-text">Journal</Text>
          <Text className="text-base text-muted">Le carnet de souvenirs de tes chevaux</Text>
        </View>
      </FadeInView>

      {horses.length > 1 ? (
        <FadeInView delay={40}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
            <TouchableOpacity
              onPress={() => setFilterHorseId(null)}
              activeOpacity={0.8}
              className={`rounded-full border px-3.5 py-2 ${filterHorseId === null ? "border-primary bg-highlight" : "border-border bg-surface"}`}
            >
              <Text className={`text-sm font-semibold ${filterHorseId === null ? "text-primary" : "text-text"}`}>
                Tous
              </Text>
            </TouchableOpacity>
            {horses.map((h) => (
              <TouchableOpacity
                key={h.id}
                onPress={() => setFilterHorseId(h.id)}
                activeOpacity={0.8}
                className={`rounded-full border px-3.5 py-2 ${filterHorseId === h.id ? "border-primary bg-highlight" : "border-border bg-surface"}`}
              >
                <Text className={`text-sm font-semibold ${filterHorseId === h.id ? "text-primary" : "text-text"}`}>
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FadeInView>
      ) : null}

      <FadeInView delay={80}>
        <JournalForm
          show={showJournalForm}
          form={journalForm}
          setForm={setJournalForm}
          editingJournalId={editingJournalId}
          saving={savingJournal}
          onOpen={() => setShowJournalForm(true)}
          onCancel={cancelJournalForm}
          onSubmit={handleSubmitJournalEntry}
        />
      </FadeInView>
      {!showJournalForm && targetHorse ? (
        <FadeInView delay={90}>
          <Text className="px-1 text-xs text-muted">
            La nouvelle entrée sera rattachée à {targetHorse.name}
            {filterHorse ? " (cheval du filtre)" : " (cheval actif)"}.
          </Text>
        </FadeInView>
      ) : null}

      {sortedJournal.length === 0 ? (
        <FadeInView delay={120}>
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="notebook-outline" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-center text-sm text-muted">
              {filterHorse
                ? `Aucun souvenir pour ${filterHorse.name} pour l'instant.`
                : "Aucune entrée de journal pour l'instant."}
            </Text>
            {!showJournalForm ? (
              <TouchableOpacity onPress={() => setShowJournalForm(true)} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-accent">Ajouter un souvenir</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </FadeInView>
      ) : (
        sortedJournal.map((entry, i) => (
          <FadeInView key={entry.id} delay={120 + i * 60}>
            <View className="gap-1.5">
              {filterHorseId === null && horses.length > 1 ? (
                <View className="flex-row items-center gap-1 self-start rounded-full bg-highlight px-2.5 py-1">
                  <MaterialCommunityIcons name="horse-variant" size={11} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">{horseName(entry.horseId)}</Text>
                </View>
              ) : null}
              <JournalCard
                entry={entry}
                expanded={expandedId === entry.id}
                onToggleExpand={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onDelete={() => deleteJournalEntry(entry.id)}
                onEdit={() => startEditJournal(entry)}
              />
            </View>
          </FadeInView>
        ))
      )}
    </Screen>
    <PickerOverlaySlot />
    </>
  );
}
