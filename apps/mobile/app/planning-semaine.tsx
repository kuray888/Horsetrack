import { useEffect, useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { ChipSelect } from "@/components/FormChips";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseRights } from "@/horses/useHorseRights";
import { useHorseTeams } from "@/horses/team";
import { useSessions } from "@/sessions/store";
import { ACTIVITY_META, useAgenda } from "@/agenda/store";
import { useSlots } from "@/planning/slotsStore";
import { sessionForOccurrence } from "@/planning/slots";
import { riderDisplayName, sessionAccess, type TeamMember } from "@/planning/riders";
import { itemsFor, myPlan, planWarnings, weekPlan, weekStart, type PlanItem, type PlanWarning } from "@/planning/week";
import { can } from "@/lib/permissions";
import { hapticSelection, hapticSuccess, hapticTap } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { notifyPlanning } from "@/planning/planningNotify";
import { LOCALE, t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const ALL = "__all";

type View_ = "stable" | "mine";

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Planning de la semaine (Écurie Pro v2) : tous les chevaux × 7 jours, avec
 * les séances et les créneaux réguliers, filtrable par cavalier ; « Mon
 * planning » pour qui monte plusieurs chevaux ; et les contrôles (cf.
 * planning/week.ts) — on avertit, on ne bloque jamais.
 */
export default function WeekPlanningScreen() {
  const colors = useThemeColors();
  const { horses } = useHorses();
  const { sessions, updateSession, toggleCompleted } = useSessions();
  const { appointments } = useAgenda();
  const slots = useSlots();
  const rights = useHorseRights();
  const [start, setStart] = useState(() => weekStart(new Date()));
  const [mode, setMode] = useState<View_>(() => (horses.some((h) => !h.sharedRole) ? "stable" : "mine"));
  const [rider, setRider] = useState<string>(ALL);
  const [selected, setSelected] = useState<{ horseId: string; day: number } | null>(null);
  useEffect(() => {
    track("week_planning_viewed", {});
  }, []);

  const horseIds = useMemo(() => horses.map((h) => h.id), [horses]);
  const teams = useHorseTeams(horseIds);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const items = useMemo(() => weekPlan(sessions, slots, start), [sessions, slots, start]);
  const warnings = useMemo(
    () =>
      planWarnings(items, {
        injuredHorseIds: new Set(horses.filter((h) => h.injuries.some((i) => i.recoveryStatus === "IN_PROGRESS")).map((h) => h.id)),
        competitions: appointments
          .filter((a) => a.type === "concours" && a.horseId)
          .map((a) => ({ horseId: a.horseId as string, start: a.date, end: a.endDate ?? a.date })),
      }),
    [items, horses, appointments]
  );

  const ownedIds = useMemo(() => new Set(horses.filter((h) => !h.sharedRole).map((h) => h.id)), [horses]);
  const mine = useMemo(() => myPlan(items, rights.me, ownedIds), [items, rights.me, ownedIds]);

  // Toutes les personnes qui montent cette semaine, pour le filtre.
  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      const name = riderName(i, teams, rights.me);
      if (name) map.set(i.riderUserId ?? `name:${i.riderName}`, name);
    }
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [items, teams, rights.me]);

  const filtered = rider === ALL ? items : items.filter((i) => (i.riderUserId ?? `name:${i.riderName}`) === rider);
  const weekLabel = `${days[0].toLocaleDateString(LOCALE, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  })}`;
  const isThisWeek = start.getTime() === weekStart(new Date()).getTime();

  function markDone(item: PlanItem) {
    hapticSuccess();
    animateNextLayout();
    // Cheval de quelqu'un d'autre : ceux qui organisent son planning sont
    // prévenus (« Léa a monté Tornade »).
    if (!ownedIds.has(item.horseId)) notifyPlanning("session", item.id, "done");
    if (item.session) {
      toggleCompleted(item.session.id);
    } else if (item.occurrence) {
      updateSession({ ...sessionForOccurrence(item.occurrence), completed: true });
      track("session_completed", { activity: item.activityType, slot: true });
    }
    if (item.riderUserId && item.riderUserId === rights.me && item.horseId && !ownedIds.has(item.horseId)) {
      track("assigned_session_done", { from: "week" });
    }
  }

  function skipOnce(item: PlanItem) {
    Alert.alert(t("Annuler cette fois ?"), t("Cette séance du créneau n'aura pas lieu. Les semaines suivantes ne changent pas."), [
      { text: t("Garder"), style: "cancel" },
      {
        text: t("Annuler cette fois"),
        style: "destructive",
        onPress: () => {
          hapticTap();
          animateNextLayout();
          const base = item.session ?? (item.occurrence ? sessionForOccurrence(item.occurrence) : null);
          if (base) updateSession({ ...base, cancelledAt: new Date() });
          if (item.riderUserId && item.riderUserId !== rights.me) notifyPlanning("session", item.id, "cancelled");
          track("slot_occurrence_cancelled", {});
        },
      },
    ]);
  }

  const horseName = (id: string) => horses.find((h) => h.id === id)?.name ?? "";

  function renderItem(item: PlanItem, showHorse: boolean) {
    const role = rights.roleFor(item.horseId);
    const access = sessionAccess(
      role,
      { riderUserId: item.riderUserId, createdByUserId: item.session ? item.session.createdByUserId : null },
      rights.me
    );
    const name = riderName(item, teams, rights.me);
    const fromSlot = !!item.occurrence || !!item.session?.slotId;
    const canSkip = fromSlot && !item.completed && can(role, "manage_planning");
    const meta = ACTIVITY_META[item.activityType];
    return (
      <View key={item.id} className="flex-row items-center gap-3 rounded-card bg-surface p-4">
        <View className={`h-10 w-10 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
        </View>
        <View className="flex-1 gap-1">
          <Text className={`text-base font-semibold ${item.completed ? "text-muted line-through" : "text-text"}`}>
            {showHorse ? `${horseName(item.horseId)} · ` : ""}
            {item.time ?? t("Heure libre")}
          </Text>
          <Text className="text-sm text-muted">
            {meta.label}
            {name ? ` · ${name}` : ""}
            {fromSlot ? ` · ${t("créneau")}` : ""}
          </Text>
        </View>
        {item.completed ? (
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.success} accessibilityLabel={t("Séance faite")} />
        ) : access !== "none" ? (
          <TouchableOpacity
            onPress={() => markDone(item)}
            accessibilityRole="button"
            accessibilityLabel={t("Marquer faite")}
            className="rounded-full bg-primary px-4 py-2"
          >
            <Text className="text-sm font-bold text-on-primary">{t("C'est fait")}</Text>
          </TouchableOpacity>
        ) : null}
        {canSkip ? (
          <TouchableOpacity onPress={() => skipOnce(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Annuler cette fois")}>
            <MaterialCommunityIcons name="calendar-remove-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const selectedItems = selected ? itemsFor(filtered, selected.horseId, addDays(start, selected.day)) : [];

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="font-display text-2xl tracking-tight text-text" accessibilityRole="header">
              {t("Planning de la semaine")}
            </Text>
            <Text className="text-sm text-muted">{weekLabel}</Text>
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
            setSelected(null);
            setStart((s) => addDays(s, -7));
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("Semaine précédente")}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        {!isThisWeek ? (
          <TouchableOpacity
            onPress={() => {
              hapticSelection();
              setSelected(null);
              setStart(weekStart(new Date()));
            }}
            accessibilityRole="button"
          >
            <Text className="text-sm font-semibold text-accent">{t("Cette semaine")}</Text>
          </TouchableOpacity>
        ) : (
          <ChipSelect
            options={[
              { value: "stable", label: t("Écurie"), icon: "horse-variant" },
              { value: "mine", label: t("Mon planning"), icon: "account-outline" },
            ]}
            value={mode}
            onChange={(v) => {
              hapticSelection();
              animateNextLayout();
              setMode(v as View_);
            }}
          />
        )}
        <TouchableOpacity
          onPress={() => {
            hapticSelection();
            setSelected(null);
            setStart((s) => addDays(s, 7));
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("Semaine suivante")}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {warnings.length > 0 ? (
        <FadeInView delay={40}>
          <View className="gap-2 rounded-card bg-warning/15 p-4" accessibilityLiveRegion="polite">
            {warnings.slice(0, 6).map((w, i) => (
              <View key={`${w.code}-${i}`} className="flex-row items-start gap-2">
                <MaterialCommunityIcons name="alert-outline" size={16} color={colors.warning} />
                <Text className="flex-1 text-sm text-text">{warningText(w, horseName)}</Text>
              </View>
            ))}
          </View>
        </FadeInView>
      ) : null}

      {mode === "mine" ? (
        <FadeInView delay={60}>
          {mine.length === 0 ? (
            <View className={`${CARD} items-center gap-2`}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={24} color={colors.textMuted} />
              <Text className="text-center text-sm text-muted">
                {t("Rien de prévu pour toi cette semaine. Les séances qu'on t'attribue apparaîtront ici.")}
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {days.map((d) => {
                const list = mine.filter((i) => i.date.getTime() === d.getTime());
                if (list.length === 0) return null;
                return (
                  <View key={d.getTime()} className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-wide text-muted">
                      {d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })}
                    </Text>
                    {list.map((i) => renderItem(i, true))}
                  </View>
                );
              })}
            </View>
          )}
        </FadeInView>
      ) : (
        <FadeInView delay={60}>
          <View className="gap-4">
            {people.length > 1 ? (
              <ChipSelect
                options={[
                  { value: ALL, label: t("Tout le monde"), icon: "account-group-outline" },
                  ...people.map((p) => ({ value: p.key, label: p.name, icon: "account-outline" })),
                ]}
                value={rider}
                onChange={(v) => {
                  hapticSelection();
                  setSelected(null);
                  setRider(v);
                }}
              />
            ) : null}

            {horses.length === 0 ? (
              <View className={`${CARD} items-center gap-2`}>
                <Text className="text-center text-sm text-muted">{t("Ajoute un cheval pour organiser sa semaine.")}</Text>
              </View>
            ) : (
              <View className={`${CARD} gap-3`}>
                <View className="flex-row">
                  {days.map((d) => (
                    <Text key={d.getTime()} className="flex-1 text-center text-xs font-bold uppercase text-muted">
                      {d.toLocaleDateString(LOCALE, { weekday: "narrow" })}
                      {"\n"}
                      {d.getDate()}
                    </Text>
                  ))}
                </View>
                {horses.map((h) => (
                  <View key={h.id} className="gap-1">
                    <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                      {h.name}
                    </Text>
                    <View className="flex-row gap-1">
                      {days.map((d, dayIndex) => {
                        const cell = itemsFor(filtered, h.id, d);
                        const isSel = selected?.horseId === h.id && selected.day === dayIndex;
                        const done = cell.filter((i) => i.completed).length;
                        return (
                          <TouchableOpacity
                            key={dayIndex}
                            onPress={() => {
                              hapticSelection();
                              animateNextLayout();
                              setSelected(isSel ? null : { horseId: h.id, day: dayIndex });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t("{horse}, {day} : {count} séance(s)", {
                              horse: h.name,
                              day: d.toLocaleDateString(LOCALE, { weekday: "long" }),
                              count: cell.length,
                            })}
                            accessibilityState={{ selected: isSel }}
                            className={`h-11 flex-1 items-center justify-center rounded-lg ${
                              isSel ? "border-2 border-primary" : ""
                            } ${cell.length === 0 ? "bg-background" : done === cell.length ? "bg-success/25" : "bg-highlight"}`}
                          >
                            {cell.length > 0 ? (
                              <Text className="text-xs font-bold text-text">{initials(cell, teams, rights.me)}</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {selected ? (
              <View className="gap-2">
                <Text className="text-xs font-bold uppercase tracking-wide text-muted">
                  {horseName(selected.horseId)} ·{" "}
                  {addDays(start, selected.day).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })}
                </Text>
                {selectedItems.length === 0 ? (
                  <Text className="text-sm text-muted">{t("Repos ce jour-là.")}</Text>
                ) : (
                  selectedItems.map((i) => renderItem(i, false))
                )}
              </View>
            ) : (
              <Text className="text-center text-sm text-muted">{t("Touche une case pour voir qui monte.")}</Text>
            )}
          </View>
        </FadeInView>
      )}
    </Screen>
  );
}

function riderName(item: PlanItem, teams: Record<string, TeamMember[]>, me: string | null): string | null {
  return riderDisplayName(item, teams[item.horseId] ?? [], me, t("Toi"));
}

/** Initiales des cavaliers d'une case (« L », « L·M »), « • » sans cavalier. */
function initials(cell: PlanItem[], teams: Record<string, TeamMember[]>, me: string | null): string {
  const letters = cell.map((i) => riderName(i, teams, me)?.trim().charAt(0).toUpperCase() || "•");
  return letters.slice(0, 2).join("·") + (letters.length > 2 ? "+" : "");
}

function warningText(w: PlanWarning, horseName: (id: string) => string): string {
  const name = w.horseId ? horseName(w.horseId) : "";
  const day = w.date ? w.date.toLocaleDateString(LOCALE, { weekday: "long" }) : "";
  switch (w.code) {
    case "horse_overlap":
      return t("{name} est prévu deux fois en même temps {day}.", { name, day });
    case "rider_overlap":
      return t("Un cavalier est prévu sur deux chevaux en même temps {day}.", { day });
    case "too_many":
      return t("{name} travaille 6 jours cette semaine : garde-lui une journée de repos.", { name });
    case "no_rest":
      return t("{name} n'a aucun jour de repos cette semaine.", { name });
    case "hard_streak":
      return t("{name} enchaîne deux séances éprouvantes en 3 jours.", { name });
    case "injured":
      return t("{name} est en convalescence : vérifie les séances prévues.", { name });
    case "competition_day":
      return t("{name} a un concours {day} : pas de séance de travail en plus.", { name, day });
    case "competition_near":
      return t("{name} : séance éprouvante {day}, à côté d'un concours.", { name, day });
  }
}
