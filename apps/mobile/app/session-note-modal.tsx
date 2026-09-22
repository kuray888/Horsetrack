import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { BackButton } from "@/components/BackButton";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { colors } from "@/theme/colors";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { JournalForm } from "@/agenda/components/JournalForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { formatDate, formatDuration } from "@/lib/dateFormat";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * « Un mot sur cette séance ? » — proposé juste après avoir coché une séance
 * comme faite (cf. sessions/useSessionDonePrompt.ts).
 *
 * Une séance et une entrée de journal décrivent le même moment : elles
 * partagent activité, date, heure et notes. Elles vivaient pourtant dans deux
 * silos, si bien que raconter sa séance obligeait à tout ressaisir dans un
 * autre onglet — et le journal restait vide.
 *
 * Cet écran ne fait que PRÉ-REMPLIR le formulaire de journal existant avec ce
 * que la séance sait déjà. Rien n'est enregistré tant que l'utilisateur ne
 * valide pas (cf. le principe : une suggestion ne devient pas une donnée
 * toute seule), et il peut tout modifier — y compris l'activité.
 */
export default function SessionNoteModal() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const { addJournalEntry, updateJournalEntry } = useAgenda();

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const horse = horses.find((h) => h.id === session?.horseId) ?? null;

  const {
    showJournalForm,
    setShowJournalForm,
    journalForm,
    setJournalForm,
    savingJournal,
    editingJournalId,
    cancelJournalForm,
    handleSubmitJournalEntry,
    handlePickJournalPhoto,
  } = useJournalForm({
    addJournalEntry,
    updateJournalEntry,
    // Le cheval de LA SÉANCE, jamais le cheval actif : on peut cocher depuis
    // l'Accueil une séance d'un autre cheval que celui affiché.
    horse: horse ?? null,
    onEditStart: () => {},
  });

  // Pré-remplissage une seule fois, à l'arrivée de la séance : ensuite,
  // l'utilisateur est maître du formulaire et ses modifications ne doivent
  // pas être écrasées à chaque rendu.
  //
  // Ajusté PENDANT le rendu plutôt que dans un effet (cf. planning.tsx, même
  // pattern) : un effet ne s'exécuterait qu'après un premier rendu, le temps
  // d'afficher un formulaire vide avant qu'il ne se remplisse sous les yeux.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (session && prefilledFor !== session.id) {
    setPrefilledFor(session.id);
    setJournalForm((f) => ({
      ...f,
      activityType: session.activityType,
      date: session.date,
      time: session.time || f.time,
      // Les notes de préparation de la séance (« travailler le contre-galop »)
      // ne sont pas le compte rendu : les recopier ferait passer une intention
      // pour un ressenti. Le champ reste vide, à remplir.
    }));
    setShowJournalForm(true);
  }

  if (!session) {
    return (
      <Screen>
        <BackButton />
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="notebook-outline" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">Cette séance est introuvable.</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  const meta = ACTIVITY_META[session.activityType];
  const title = session.customActivityLabel || meta.label;

  function closeModal() {
    cancelJournalForm();
    router.back();
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="gap-1">
            <Text className="text-2xl font-display tracking-tight text-text">Un mot sur cette séance ?</Text>
            <Text className="text-sm text-muted">
              Ce que tu écris ici rejoint le journal de {horse?.name ?? "ton cheval"}.
            </Text>
          </View>
        </FadeInView>

        {/* Rappel de la séance concernée : cocher une case et voir apparaître
            un formulaire sans contexte laisserait douter de ce qu'on raconte. */}
        <FadeInView delay={40}>
          <View className={`${CARD} flex-row items-center gap-3`}>
            <View className={`h-10 w-10 items-center justify-center rounded-full ${meta.chip}`}>
              <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold text-text">{title}</Text>
              <Text className="text-sm text-muted">
                {formatDate(session.date)}
                {session.time ? ` · ${session.time}` : ""}
                {session.durationMinutes ? ` · ${formatDuration(session.durationMinutes)}` : ""}
              </Text>
            </View>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
          </View>
        </FadeInView>

        <FadeInView delay={80}>
          <JournalForm
            show={showJournalForm}
            form={journalForm}
            setForm={setJournalForm}
            editingJournalId={editingJournalId}
            saving={savingJournal}
            targetHorseName={horse?.name ?? null}
            onOpen={() => setShowJournalForm(true)}
            onCancel={closeModal}
            onSubmit={() => {
              handleSubmitJournalEntry();
              router.back();
            }}
            onPickPhoto={handlePickJournalPhoto}
          />
        </FadeInView>
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
