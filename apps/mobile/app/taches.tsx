import { useMemo, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Redirect, router } from "expo-router";
import { PRO_ENABLED } from "@/lib/features";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { TimePickerField } from "@/components/TimePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { PrimaryButton } from "@/components/onboarding";
import { AddToggle, ChipSelect } from "@/components/FormChips";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseRights } from "@/horses/useHorseRights";
import { useHorseTeams } from "@/horses/team";
import { useSubscription } from "@/subscription/store";
import { deleteTask, saveTask, setTaskDone, useTasks } from "@/tasks/tasksStore";
import { canTick, myTasks, recurrenceLabel, summarizeDay, tasksForDay } from "@/tasks/tasksModel";
import { riderColumns } from "@/planning/riders";
import { hapticSelection, hapticSuccess, hapticTap } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { LOCALE, t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const NOBODY = "__nobody";
const OTHER = "__other";
const DAYS = [
  { value: 1, label: t("Lun") },
  { value: 2, label: t("Mar") },
  { value: 3, label: t("Mer") },
  { value: 4, label: t("Jeu") },
  { value: 5, label: t("Ven") },
  { value: 6, label: t("Sam") },
  { value: 7, label: t("Dim") },
];

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Tâches d'écurie (Écurie Pro v2) : sortie au pré, repas, couverture, soin
 * noté par vous. La liste du jour pour toute l'écurie, ou « Mes tâches » ;
 * on coche d'un toucher, avec qui et quand. L'app ne propose jamais de
 * posologie : le texte est le vôtre (cf. tasks/tasksModel.ts).
 */
function TasksScreen() {
  const colors = useThemeColors();
  const { horses } = useHorses();
  const rights = useHorseRights();
  const { isPro } = useSubscription();
  const { tasks, completions } = useTasks();
  const teams = useHorseTeams(useMemo(() => horses.map((h) => h.id), [horses]));
  const [day, setDay] = useState(() => new Date());
  const [mine, setMine] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [horseId, setHorseId] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [time, setTime] = useState("");
  const [assignee, setAssignee] = useState<string>(NOBODY);
  const [assigneeName, setAssigneeName] = useState("");

  const writable = horses.filter((h) => rights.can(h.id, "manage_tasks") && (!!h.sharedRole || isPro));
  const targetId = horseId ?? writable[0]?.id ?? null;
  const members = targetId ? (teams[targetId] ?? []) : [];
  const all = tasksForDay(tasks, completions, day);
  const shown = mine ? myTasks(all, rights.me) : all;
  const summary = summarizeDay(all, new Date());
  const horseName = (id: string) => horses.find((h) => h.id === id)?.name ?? "";
  const dayLabel = day.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  const isToday = day.toDateString() === new Date().toDateString();

  function toggle(task: (typeof tasks)[number], done: boolean) {
    hapticTap();
    animateNextLayout();
    setTaskDone(task, day, !done, rights.me);
    if (!done) track("task_done", { recurring: task.weekdays.length > 0 });
  }

  function handleAdd() {
    if (!targetId || !title.trim()) return;
    const who =
      assignee === NOBODY ? { riderUserId: null, riderName: null } : assignee === OTHER ? riderColumns(null, assigneeName) : riderColumns(assignee, "");
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    saveTask({
      horseId: targetId,
      title: title.trim().slice(0, 120),
      assigneeUserId: who.riderUserId,
      assigneeName: who.riderName,
      weekdays,
      dueDate: weekdays.length === 0 ? start : null,
      time: time || null,
      notes: "",
      validFrom: start,
      validUntil: null,
    });
    track("task_created", { recurring: weekdays.length > 0, assigned: assignee !== NOBODY });
    hapticSuccess();
    animateNextLayout();
    setTitle("");
    setWeekdays([]);
    setTime("");
    setAssignee(NOBODY);
    setAssigneeName("");
    setShowForm(false);
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert(t("Supprimer cette tâche ?"), t("« {name} » disparaît pour tous les jours, passés compris.", { name }), [
      { text: t("Annuler"), style: "cancel" },
      { text: t("Supprimer"), style: "destructive", onPress: () => deleteTask(id) },
    ]);
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-1">
              <Text className="font-display text-2xl tracking-tight text-text" accessibilityRole="header">
                {t("Tâches")}
              </Text>
              <Text className="text-sm capitalize text-muted">{dayLabel}</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => {
              hapticSelection();
              setDay((d) => addDays(d, -1));
            }}
            accessibilityRole="button"
            accessibilityLabel={t("Jour précédent")}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface"
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          {isToday ? (
            <ChipSelect
              options={[
                { value: "all", label: t("Toute l'écurie"), icon: "horse-variant" },
                { value: "mine", label: t("Mes tâches"), icon: "account-outline" },
              ]}
              value={mine ? "mine" : "all"}
              onChange={(v) => {
                hapticSelection();
                animateNextLayout();
                setMine(v === "mine");
              }}
            />
          ) : (
            <TouchableOpacity onPress={() => setDay(new Date())} accessibilityRole="button">
              <Text className="text-sm font-semibold text-accent">{t("Aujourd'hui")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              hapticSelection();
              setDay((d) => addDays(d, 1));
            }}
            accessibilityRole="button"
            accessibilityLabel={t("Jour suivant")}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface"
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {summary.total > 0 ? (
          <View className={`flex-row items-center gap-2 rounded-card p-4 ${summary.late > 0 ? "bg-warning/15" : "bg-success/15"}`} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name={summary.late > 0 ? "clock-alert-outline" : "check-circle-outline"} size={18} color={summary.late > 0 ? colors.warning : colors.success} />
            <Text className="flex-1 text-sm font-semibold text-text">
              {t("{done} sur {total} faites", { done: summary.done, total: summary.total })}
              {summary.late > 0 ? ` · ${t("{count} en retard", { count: summary.late })}` : ""}
            </Text>
          </View>
        ) : null}

        <FadeInView delay={40}>
          <View className="gap-2">
            {shown.length === 0 ? (
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-center text-sm text-muted">
                  {mine
                    ? t("Rien ne t'est confié ce jour-là.")
                    : writable.length > 0
                      ? t("Aucune tâche ce jour-là. Ajoute la sortie au pré, les repas, la couverture…")
                      : t("Aucune tâche ce jour-là.")}
                </Text>
              </View>
            ) : (
              shown.map((o) => {
                const done = !!o.completion;
                const tickable = canTick(o.task, rights.me, rights.can(o.task.horseId, "manage_tasks"));
                const who = o.task.assigneeUserId
                  ? o.task.assigneeUserId === rights.me
                    ? t("Toi")
                    : (teams[o.task.horseId] ?? []).find((m) => m.userId === o.task.assigneeUserId)?.name
                  : o.task.assigneeName;
                const doneBy = o.completion?.doneByUserId
                  ? o.completion.doneByUserId === rights.me
                    ? t("toi")
                    : (teams[o.task.horseId] ?? []).find((m) => m.userId === o.completion?.doneByUserId)?.name
                  : null;
                const rec = recurrenceLabel(o.task.weekdays, t("tous les jours"));
                return (
                  <View key={o.task.id} className="flex-row items-center gap-3 rounded-card bg-surface p-4">
                    <TouchableOpacity
                      onPress={() => toggle(o.task, done)}
                      disabled={!tickable}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done, disabled: !tickable }}
                      accessibilityLabel={`${o.task.title}, ${horseName(o.task.horseId)}`}
                      className={`h-7 w-7 items-center justify-center rounded-full ${done ? "bg-success" : "border-2 border-border"}`}
                    >
                      {done ? <MaterialCommunityIcons name="check" size={17} color="#ffffff" /> : null}
                    </TouchableOpacity>
                    <View className="flex-1 gap-1">
                      <Text className={`text-base font-semibold ${done ? "text-muted line-through" : "text-text"}`}>{o.task.title}</Text>
                      <Text className="text-sm text-muted">
                        {[horseName(o.task.horseId), o.task.time, who, rec].filter(Boolean).join(" · ")}
                        {done && doneBy ? ` · ${t("fait par {name}", { name: doneBy })}` : ""}
                      </Text>
                    </View>
                    {rights.can(o.task.horseId, "manage_tasks") ? (
                      <TouchableOpacity onPress={() => confirmDelete(o.task.id, o.task.title)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Supprimer")}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </FadeInView>

        {writable.length === 0 && horses.some((h) => !h.sharedRole) && !isPro ? (
          <View className={`${CARD} gap-3`}>
            <Text className="text-base font-semibold text-text">{t("Qui fait quoi à l'écurie")}</Text>
            <Text className="text-sm text-muted">
              {t("Confie la sortie au pré, les repas ou la couverture à ton groom ou ta demi-pension, et vois qui a fait quoi. Avec Écurie Pro.")}
            </Text>
            <PrimaryButton label={t("Découvrir Écurie Pro")} onPress={() => router.push("/pro")} />
          </View>
        ) : null}

        {writable.length > 0 ? (
          <FadeInView delay={60}>
            {showForm ? (
              <View className={`${CARD} gap-4`}>
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">{t("Nouvelle tâche")}</Text>
                <Field label={t("Quoi ?")}>
                  <TextInput className={INPUT} placeholder={t("Ex : Sortie au pré")} placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} maxLength={120} accessibilityLabel={t("Quoi ?")} />
                </Field>
                {writable.length > 1 ? (
                  <Field label={t("Pour quel cheval ?")}>
                    <ChipSelect
                      options={writable.map((h) => ({ value: h.id, label: h.name, icon: "horse-variant" }))}
                      value={targetId}
                      onChange={(v) => {
                        hapticSelection();
                        setHorseId(v);
                        setAssignee(NOBODY);
                      }}
                    />
                  </Field>
                ) : null}
                <Field label={t("Répéter")}>
                  <View className="flex-row flex-wrap gap-2">
                    {DAYS.map((d) => {
                      const on = weekdays.includes(d.value);
                      return (
                        <TouchableOpacity
                          key={d.value}
                          onPress={() => {
                            hapticSelection();
                            setWeekdays((w) => (on ? w.filter((x) => x !== d.value) : [...w, d.value].sort()));
                          }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          className={`h-11 w-11 items-center justify-center rounded-full border ${on ? "border-primary bg-highlight" : "border-border bg-surface"}`}
                        >
                          <Text className={`text-sm font-semibold ${on ? "text-primary" : "text-text"}`}>{d.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text className="text-sm text-muted">{weekdays.length === 0 ? t("Sans jour choisi, la tâche n'a lieu que ce jour-là.") : t("Chaque semaine, aux jours choisis.")}</Text>
                </Field>
                <TimePickerField label={t("Heure (optionnel)")} value={time} onChange={setTime} />
                <Field label={t("Confiée à")}>
                  <ChipSelect
                    options={[
                      { value: NOBODY, label: t("Personne en particulier"), icon: "account-question-outline" },
                      ...members.map((m) => ({ value: m.userId, label: m.userId === rights.me ? t("Moi") : m.name, icon: "account-outline" })),
                      { value: OTHER, label: t("Quelqu'un d'autre"), icon: "account-plus-outline" },
                    ]}
                    value={assignee}
                    onChange={(v) => {
                      hapticSelection();
                      setAssignee(v);
                    }}
                  />
                  {assignee === OTHER ? (
                    <TextInput className={INPUT} placeholder={t("Son prénom")} placeholderTextColor={colors.textMuted} value={assigneeName} onChangeText={setAssigneeName} maxLength={60} accessibilityLabel={t("Son prénom")} />
                  ) : null}
                </Field>
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setShowForm(false)} accessibilityRole="button" className="flex-1 items-center rounded-card border border-border p-4">
                    <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <PrimaryButton label={t("Ajouter")} disabled={!title.trim() || (assignee === OTHER && !assigneeName.trim())} onPress={handleAdd} />
                  </View>
                </View>
              </View>
            ) : (
              <AddToggle label={t("Ajouter une tâche")} onPress={() => setShowForm(true)} color={colors.primary} />
            )}
          </FadeInView>
        ) : null}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}

/** Écurie Pro n'est pas ouvert dans cette version (cf. lib/features.ts). */
export default function TasksScreenGuard() {
  if (!PRO_ENABLED) return <Redirect href="/" />;
  return <TasksScreen />;
}
