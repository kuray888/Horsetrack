import { useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { HorseNameBadge } from "@/horses/components/HorseFilterChips";
import { HorseSwitcher } from "@/horses/components/HorseSwitcher";
import { useAgenda, type JournalEntry } from "@/agenda/store";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";
import { JournalCard } from "@/agenda/components/JournalCard";
import { animateNextLayout } from "@/lib/motion";
import { lazyTab } from "@/components/LazyTab";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SwipeableRow } from "@/components/SwipeableRow";
import { QuickAddSheet, openQuickAddFromTab, type QuickAddOption } from "@/components/QuickAddSheet";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Entrées affichées d'un coup. Chaque souvenir peut porter une photo : tout
 * rendre à l'ouverture décodait des centaines d'images chez un cavalier qui
 * tient son journal depuis longtemps, et l'onglet ralentissait d'autant. */
const JOURNAL_PAGE_SIZE = 25;

/** Journal global (cf. plan Phase 3 Étape 5) — même formulaire/carte que
 * l'ancien onglet Journal de l'Agenda (`useJournalForm`/`JournalForm`/
 * `JournalCard`, réutilisés tels quels), mais montre les entrées de tous les
 * chevaux avec un filtre. La création suit le filtre quand il cible un
 * cheval précis (cf. `addJournalEntry`'s `horseId` optionnel dans
 * agenda/store.tsx — un seul mécanisme, pas de deuxième source de vérité :
 * override explicite si le filtre est posé, sinon même fallback qu'avant sur
 * le cheval globalement sélectionné). */
function JournalScreen() {
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
  const [quickAddVisible, setQuickAddVisible] = useState(false);

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
    handlePickJournalPhoto,
  } = useJournalForm({
    addJournalEntry: (entry) => addJournalEntry(filterHorseId ? { ...entry, horseId: filterHorseId } : entry),
    updateJournalEntry,
    onEditStart: () => setExpandedId(null),
  });

  const sortedJournal = useMemo(() => {
    const filtered = filterHorseId ? journal.filter((j) => j.horseId === filterHorseId) : journal;
    return [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [journal, filterHorseId]);

  // Repart d'une page à chaque changement de filtre (même pattern
  // « ajuster pendant le rendu » que syncedHorseParam ci-dessus).
  const [visibleCount, setVisibleCount] = useState(JOURNAL_PAGE_SIZE);
  const [pagedFilter, setPagedFilter] = useState(filterHorseId);
  if (pagedFilter !== filterHorseId) {
    setPagedFilter(filterHorseId);
    setVisibleCount(JOURNAL_PAGE_SIZE);
  }
  const visibleJournal = sortedJournal.slice(0, visibleCount);
  const hiddenCount = sortedJournal.length - visibleJournal.length;

  function horseName(horseId: string | null): string {
    return horses.find((h) => h.id === horseId)?.name ?? "?";
  }

  function confirmDeleteJournalEntry(entry: JournalEntry) {
    Alert.alert(t("Supprimer cette entrée ?"), t("Cette action est définitive."), [
      { text: t("Annuler"), style: "cancel" },
      { text: t("Supprimer"), style: "destructive", onPress: () => deleteJournalEntry(entry.id) },
    ]);
  }

  // Même « + » que partout (cf. components/QuickAddSheet.tsx) : un souvenir
  // s'écrit ici, le reste s'ouvre là où vit son formulaire.
  function handleQuickAdd(option: QuickAddOption) {
    setQuickAddVisible(false);
    if (option === "journal") setShowJournalForm(true);
    else openQuickAddFromTab(option);
  }

  return (
    <>
    <Screen>
      <FadeInView>
        <ScreenTitle
          title={t("Journal")}
          subtitle={t("Le carnet de souvenirs de tes chevaux")}
          onAdd={showJournalForm ? undefined : () => setQuickAddVisible(true)}
          addLabel={t("Ajouter")}
        />
      </FadeInView>

      {horses.length > 1 ? (
        <FadeInView delay={40}>
          {/* Le Journal liste TOUS les chevaux, partagés compris : un cavalier
              en demi-pension y écrit et y relit ses souvenirs depuis
              l'origine. Le Planning, lui, s'en tient aux chevaux possédés
              (cf. horses/selectableHorses.ts) — d'où la liste passée en
              paramètre plutôt que lue dans le composant. */}
          {/* Même sélecteur que l'Accueil et le Planning : choisir un cheval
              en fait le cheval actif de l'app, « Tous » mêle l'écurie. Un
              cheval verrouillé se relit quand même (filtre seul, sans
              paywall) : ses souvenirs restent à lui. */}
          <HorseSwitcher
            allOption={{ selected: filterHorseId === null, onSelect: () => setFilterHorseId(null) }}
            selectedId={filterHorseId}
            onSelect={(id) => setFilterHorseId(id)}
            onLockedPress={(id) => setFilterHorseId(id)}
          />
        </FadeInView>
      ) : null}

      {/* Ouvert par le « + » du titre (ou « Modifier » sur une carte). Le
          cheval qui recevra l'entrée s'affiche dans le formulaire (« Pour
          X »), là où la question se pose, plutôt qu'en permanence sous la
          liste. */}
      {showJournalForm ? (
        <FadeInView>
          <JournalForm
            show={showJournalForm}
            form={journalForm}
            setForm={setJournalForm}
            editingJournalId={editingJournalId}
            saving={savingJournal}
            targetHorseName={editingJournalId ? null : targetHorse?.name ?? null}
            onOpen={() => setShowJournalForm(true)}
            onCancel={cancelJournalForm}
            onSubmit={handleSubmitJournalEntry}
            onPickPhoto={handlePickJournalPhoto}
          />
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
                ? t("Aucun souvenir pour {name} pour l'instant.", { name: filterHorse.name })
                : t("Aucune entrée de journal pour l'instant.")}
            </Text>
            {!showJournalForm ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowJournalForm(true)} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-accent">{t("Ajouter un souvenir")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </FadeInView>
      ) : (
        visibleJournal.map((entry, i) => (
          <FadeInView key={entry.id} delay={120 + i * 60}>
            <View className="gap-1.5">
              {filterHorseId === null && horses.length > 1 ? (
                <HorseNameBadge name={horseName(entry.horseId)} />
              ) : null}
              <SwipeableRow
                trailing={{
                  label: t("Supprimer"),
                  icon: "trash-can-outline",
                  color: colors.danger,
                  onPress: () => confirmDeleteJournalEntry(entry),
                }}
              >
                <JournalCard
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggleExpand={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onDelete={() => confirmDeleteJournalEntry(entry)}
                  onEdit={() => startEditJournal(entry)}
                />
              </SwipeableRow>
            </View>
          </FadeInView>
        ))
      )}
      {hiddenCount > 0 ? (
        <TouchableOpacity
          onPress={() => {
            animateNextLayout();
            setVisibleCount((n) => n + JOURNAL_PAGE_SIZE);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          className="items-center rounded-card border border-border py-3.5"
        >
          <Text className="text-sm font-semibold text-accent">
            {hiddenCount === 1
              ? t("Afficher le souvenir plus ancien")
              : t("Afficher {v} souvenirs plus anciens", { v: Math.min(hiddenCount, JOURNAL_PAGE_SIZE) })}
          </Text>
          <Text className="text-xs text-muted">
            {t("{n} restant{v}", { n: hiddenCount, v: hiddenCount > 1 ? "s" : "" })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Screen>
    <PickerOverlaySlot />
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    </>
  );
}

export default lazyTab(JournalScreen);
