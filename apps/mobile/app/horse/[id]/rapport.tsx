import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseRights } from "@/horses/useHorseRights";
import { useHorseTeam } from "@/horses/team";
import { useSubscription } from "@/subscription/store";
import { ACTIVITY_META, useAgenda } from "@/agenda/store";
import { APPT_META, HEALTH_APPT_TYPES } from "@/agenda/meta";
import { useSessions } from "@/sessions/store";
import { useWeight } from "@/horses/weightStore";
import { useFees } from "@/fees/feesStore";
import { useTasks } from "@/tasks/tasksStore";
import { summarizeMonth, monthKey } from "@/fees/feesModel";
import { tasksForDay } from "@/tasks/tasksModel";
import { riderDisplayName } from "@/planning/riders";
import { buildMonthlyReportLines, inMonth, ridersOf, hoursLabel, type MonthlyReportInput } from "@/stable/monthlyReport";
import { exportMonthlyReport } from "@/stable/exportMonthlyReport";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { recordPositiveMoment } from "@/lib/reviewPrompt";
import { track } from "@/lib/analytics";
import { LOCALE, t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const shiftMonth = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/**
 * Rapport du mois pour un cheval (Écurie Pro v2), en PDF : séances et
 * cavaliers, soins, pesées, tâches ; dépenses et frais seulement pour qui y a
 * droit. À envoyer au propriétaire, à la demi-pension ou au coach.
 */
export default function MonthlyReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { horses } = useHorses();
  const horse = horses.find((h) => h.id === id);
  const rights = useHorseRights();
  const { isPro } = useSubscription();
  const team = useHorseTeam(horse?.id);
  const { appointments, expenses } = useAgenda();
  const { sessions } = useSessions();
  const { measurements } = useWeight();
  const fees = useFees();
  const { tasks, completions } = useTasks();
  const [month, setMonth] = useState(() => shiftMonth(startOfMonth(new Date()), -1));
  const [busy, setBusy] = useState(false);

  const isOwner = !!horse && !horse.sharedRole;
  if (!horse) {
    return (
      <Screen>
        <View className={`${CARD} items-center`}>
          <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
        </View>
      </Screen>
    );
  }
  const locked = isOwner && !isPro;
  const canMoney = rights.can(horse.id, "manage_expenses");
  const canFees = rights.can(horse.id, "manage_fees");

  const riderName = (s: { riderUserId?: string | null; riderName?: string | null; doneByUserId?: string | null }) =>
    riderDisplayName({ riderUserId: s.riderUserId ?? s.doneByUserId ?? null, riderName: s.riderName }, team, rights.me, t("Toi"));

  const input: MonthlyReportInput = {
    horseName: horse.name,
    month,
    sessions: sessions
      .filter((s) => s.horseId === horse.id)
      .map((s) => ({
        date: s.date,
        completed: s.completed,
        cancelled: !!s.cancelledAt,
        label: s.customActivityLabel || ACTIVITY_META[s.activityType].label,
        durationMinutes: s.durationMinutes,
        riderName: riderName(s),
      })),
    care: appointments
      .filter((a) => a.horseId === horse.id && HEALTH_APPT_TYPES.includes(a.type))
      .map((a) => ({ date: a.date, typeLabel: APPT_META[a.type].label, title: a.title, professional: a.professional })),
    weights: measurements.filter((m) => m.horseId === horse.id).map((m) => ({ date: m.date, weightKg: m.weightKg })),
    tasks: (() => {
      let total = 0;
      let done = 0;
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const list = tasksForDay(tasks.filter((x) => x.horseId === horse.id), completions, new Date(month.getFullYear(), month.getMonth(), d));
        total += list.length;
        done += list.filter((o) => o.completion).length;
      }
      return total > 0 ? { total, done } : null;
    })(),
    expenses: canMoney
      ? expenses.filter((e) => e.horseId === horse.id).map((e) => ({ date: e.date, amount: e.amount, label: e.notes || e.category }))
      : null,
    fees: canFees ? (() => { const f = summarizeMonth(fees, horse.id, monthKey(month)); return { total: f.total, paid: f.paid, due: f.due }; })() : null,
  };

  const lines = buildMonthlyReportLines(input, new Date());
  const monthSessions = input.sessions.filter((s) => inMonth(s.date, month) && s.completed && !s.cancelled);
  const minutes = monthSessions.reduce((n, s) => n + (s.durationMinutes ?? 0), 0);
  const riders = ridersOf(input.sessions.filter((s) => inMonth(s.date, month)));
  const monthLabel = month.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  const isCurrent = month.getTime() >= startOfMonth(new Date()).getTime();

  async function share() {
    if (busy) return;
    setBusy(true);
    const ok = await exportMonthlyReport(input);
    setBusy(false);
    if (ok) {
      hapticSuccess();
      recordPositiveMoment("pdf_exported");
      track("monthly_report_shared", { sessions: monthSessions.length, money: canMoney });
    }
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="font-display text-2xl tracking-tight text-text" accessibilityRole="header">
              {t("Rapport du mois")}
            </Text>
            <Text className="text-sm text-muted">{horse.name}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      {locked ? (
        <View className={`${CARD} gap-3`}>
          <Text className="text-base font-semibold text-text">{t("Un bilan à envoyer, chaque mois")}</Text>
          <Text className="text-sm text-muted">
            {t("Séances et cavaliers, soins, pesées et tâches du mois en un PDF, à remettre au propriétaire, à la demi-pension ou au coach. Avec Écurie Pro.")}
          </Text>
          <PrimaryButton label={t("Découvrir Écurie Pro")} onPress={() => router.push("/pro")} />
        </View>
      ) : (
        <>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => {
                hapticSelection();
                setMonth((m) => shiftMonth(m, -1));
              }}
              accessibilityRole="button"
              accessibilityLabel={t("Mois précédent")}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface"
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text className="text-base font-semibold capitalize text-text">{monthLabel}</Text>
            <TouchableOpacity
              onPress={() => {
                hapticSelection();
                setMonth((m) => shiftMonth(m, 1));
              }}
              disabled={isCurrent}
              accessibilityRole="button"
              accessibilityLabel={t("Mois suivant")}
              accessibilityState={{ disabled: isCurrent }}
              className={`h-11 w-11 items-center justify-center rounded-full bg-surface ${isCurrent ? "opacity-40" : ""}`}
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FadeInView delay={40}>
            <View className={`${CARD} gap-2`}>
              <Text className="text-sm text-muted">{t("Séances faites")}</Text>
              <Text className="font-display text-3xl tracking-tight text-text">{monthSessions.length}</Text>
              {minutes > 0 ? <Text className="text-sm text-muted">{hoursLabel(minutes)}</Text> : null}
              {riders.map((r) => (
                <Text key={r.name ?? "?"} className="text-sm text-text">
                  {r.name ?? t("Cavalier non précisé")} · {t("{count} séance(s)", { count: r.sessions })}
                  {r.minutes > 0 ? ` · ${hoursLabel(r.minutes)}` : ""}
                </Text>
              ))}
              {monthSessions.length === 0 ? <Text className="text-sm text-muted">{t("Aucune séance ce mois-ci.")}</Text> : null}
            </View>
          </FadeInView>

          <Text className="text-center text-sm text-muted">
            {canMoney
              ? t("Le rapport comprend les dépenses : ne l'envoie qu'à quelqu'un de confiance.")
              : t("Les dépenses ne figurent pas dans ce rapport.")}
          </Text>
          <PrimaryButton label={busy ? t("Un instant…") : t("Partager le rapport (PDF)")} disabled={busy || lines.length === 0} onPress={share} />
        </>
      )}
    </Screen>
  );
}
