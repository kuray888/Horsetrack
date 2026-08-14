import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useSubscription } from "@/subscription/store";
import { useProgram } from "./store";
import { useProgress } from "@/progress/store";
import { generateProgramWeek, type ProgramWeekHistoryEntry } from "@/lib/programWeek";
import { computeSessionsPerWeek, spreadDays, WEEKEND_DAYS } from "./rules";
import type { ProgramWeek } from "./types";

/**
 * Composant SANS RENDU : orchestre la génération de la semaine à venir dès
 * qu'elle manque pour le cheval sélectionné (cursus continu, cf.
 * apps/api/.../program-week). Vit ici plutôt que dans program/store.tsx car
 * il a besoin à la fois de useProgram() (le programme lui-même) ET
 * useProgress() (quelles séances ont été faites, avec quel ressenti — le
 * signal qui permet à l'IA de faire vraiment progresser le cursus) : ces deux
 * providers ont une dépendance à sens unique (ProgressProvider est imbriqué
 * DANS ProgramProvider, cf. app/_layout.tsx), donc program/store.tsx ne peut
 * pas lire useProgress() lui-même sans créer un cycle. Un composant monté à
 * l'intérieur des deux providers n'a pas ce problème.
 *
 * À monter une seule fois, dans l'arbre, sous <ProgressProvider>.
 */
export function CurriculumEngine() {
  const { selectedHorse } = useHorses();
  const { riderProfile } = useRiderProfile();
  const { isGrandPrix } = useSubscription();
  const { program, currentWeekNumber, getWeekDates, generatingWeek, setGeneratingWeek, appendGeneratedWeek, loading } =
    useProgram();
  const { isDone, getDebrief } = useProgress();
  const fetchingRef = useRef<Set<string>>(new Set());

  const horseId = selectedHorse?.id ?? null;

  useEffect(() => {
    if (loading || generatingWeek || !horseId || !selectedHorse || !isGrandPrix) return;

    const existingWeekNumbers = new Set((program?.weeks ?? []).map((w) => w.weekNumber));
    // Toujours une semaine d'avance générée, pour qu'un cavalier qui ouvre
    // l'app en fin de semaine voie déjà la suite plutôt qu'un planning vide
    // le temps de l'appel IA.
    const targetWeek = program ? currentWeekNumber + 1 : 1;
    if (existingWeekNumbers.has(targetWeek)) return;

    const fetchKey = `${horseId}:${targetWeek}`;
    if (fetchingRef.current.has(fetchKey)) return;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return; // pas encore de compte créé — retentera au prochain rendu

      fetchingRef.current.add(fetchKey);
      setGeneratingWeek(true);
      try {
        const { count } = computeSessionsPerWeek(riderProfile, selectedHorse);
        const dayOffsets = spreadDays(count, riderProfile.rideFrequency === "WEEKEND" ? WEEKEND_DAYS : undefined);

        // Fenêtre récente pour que l'IA juge la progression réelle — séances
        // déjà passées uniquement (une séance future n'a ni "fait" ni ressenti).
        const recentHistory: ProgramWeekHistoryEntry[] = (program?.weeks ?? [])
          .flatMap((week) => {
            const dates = getWeekDates(week.weekNumber);
            return week.sessions.map((s, i) => {
              const date = dates[s.dayOffset];
              if (!date) return null;
              const id = `${horseId}-w${week.weekNumber}-s${i}`;
              return {
                date: date.toISOString(),
                type: s.type,
                intensity: s.intensity,
                completed: isDone(id),
                debriefMood: getDebrief(id)?.mood ?? null,
              };
            });
          })
          .filter((h): h is ProgramWeekHistoryEntry => h !== null && new Date(h.date) < new Date())
          .slice(-15);

        const res = await generateProgramWeek({
          horse: selectedHorse,
          rider: riderProfile,
          weekNumber: targetWeek,
          dayOffsets,
          typeOccurrences: program?.typeOccurrences ?? {},
          recentHistory,
        });

        const week: ProgramWeek = {
          weekNumber: targetWeek,
          sessions: res.sessions.map((s) => ({
            dayOffset: s.dayOffset,
            time: "",
            type: s.type,
            title: s.title,
            durationMin: s.durationMin,
            focus: s.focus,
            intensity: s.intensity,
            equipment: s.equipment,
            setupNotes: s.setupNotes,
            exercises: s.exercises,
            rationale: s.rationale,
          })),
        };
        appendGeneratedWeek(horseId, week, res.typeOccurrences, res.safetyNotes, selectedHorse.name);
      } catch {
        // Best-effort : /api/program-week a elle-même un repli déterministe
        // en cas d'échec de l'appel IA — une erreur ici ne peut venir que
        // d'un problème réseau/auth. On retentera au prochain rendu plutôt
        // que de bloquer l'écran.
      } finally {
        fetchingRef.current.delete(fetchKey);
        setGeneratingWeek(false);
      }
    })();
  }, [
    loading,
    generatingWeek,
    horseId,
    selectedHorse,
    riderProfile,
    isGrandPrix,
    program,
    currentWeekNumber,
    getWeekDates,
    isDone,
    getDebrief,
    appendGeneratedWeek,
    setGeneratingWeek,
  ]);

  return null;
}
