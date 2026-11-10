import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Locked } from "@/components/Locked";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { EXPENSE_META } from "@/agenda/meta";
import type { Expense } from "@/agenda/store";
import { buildBudgetReportLines, expensesOfYear, yearsWithExpenses, type BudgetExpense } from "@/budget/budgetReport";
import { exportBudget } from "@/budget/exportBudget";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { recordPositiveMoment } from "@/lib/reviewPrompt";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

/**
 * Exporter les dépenses d'un cheval pour une année, en PDF (à remettre) ou en
 * CSV (tableur, comptable). Premium, comme le reste du budget détaillé.
 */
export function BudgetExportCard({ horseName, expenses }: { horseName: string; expenses: Expense[] }) {
  const colors = useThemeColors();
  const list: BudgetExpense[] = useMemo(
    () =>
      expenses.map((e) => ({
        date: e.date,
        amount: e.amount,
        categoryLabel: EXPENSE_META[e.category].label,
        notes: e.notes ?? "",
        isPaid: e.isPaid,
      })),
    [expenses]
  );
  const years = useMemo(() => yearsWithExpenses(list), [list]);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  if (years.length === 0) return null;

  const year = picked !== null && years.includes(picked) ? picked : years[0];
  const index = years.indexOf(year);
  const count = expensesOfYear(list, year).length;

  async function run(format: "pdf" | "csv") {
    if (busy) return;
    setBusy(format);
    const ok = await exportBudget({ horseName, year, expenses: list }, format);
    setBusy(null);
    if (ok) {
      hapticSuccess();
      recordPositiveMoment("pdf_exported");
      track("budget_exported", { format, expenses: count });
    }
  }

  const step = (delta: number) => {
    hapticSelection();
    setPicked(years[index + delta]);
  };

  return (
    <Locked message={t("Exporte tes dépenses de l'année en PDF ou en tableur")} placement="budget" feature="budget_export">
      <View className="gap-3 rounded-card bg-surface p-5 shadow-card">
        <Text className="text-base font-semibold text-text">{t("Exporter les dépenses")}</Text>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => step(1)}
            disabled={index >= years.length - 1}
            accessibilityRole="button"
            accessibilityLabel={t("Année précédente")}
            accessibilityState={{ disabled: index >= years.length - 1 }}
            className={`h-11 w-11 items-center justify-center rounded-full bg-border ${index >= years.length - 1 ? "opacity-40" : ""}`}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-text">{t("{year} · {count} dépense(s)", { year, count })}</Text>
          <TouchableOpacity
            onPress={() => step(-1)}
            disabled={index <= 0}
            accessibilityRole="button"
            accessibilityLabel={t("Année suivante")}
            accessibilityState={{ disabled: index <= 0 }}
            className={`h-11 w-11 items-center justify-center rounded-full bg-border ${index <= 0 ? "opacity-40" : ""}`}
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <PrimaryButton
          label={busy === "pdf" ? t("Un instant…") : t("Partager en PDF")}
          disabled={busy !== null || buildBudgetReportLines({ horseName, year, expenses: list }, new Date()).length === 0}
          onPress={() => run("pdf")}
        />
        <TouchableOpacity
          onPress={() => run("csv")}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy !== null }}
          className="items-center rounded-card bg-border p-4"
        >
          <Text className="text-[15px] font-semibold text-text">{busy === "csv" ? t("Un instant…") : t("Partager en tableur (CSV)")}</Text>
        </TouchableOpacity>
      </View>
    </Locked>
  );
}
