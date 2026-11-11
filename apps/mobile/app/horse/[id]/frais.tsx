import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { PRO_ENABLED } from "@/lib/features";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/onboarding";
import { AddToggle, ChipSelect } from "@/components/FormChips";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseRights } from "@/horses/useHorseRights";
import { useHorseTeam } from "@/horses/team";
import { useHorseDetails } from "@/extras/store";
import { useSubscription } from "@/subscription/store";
import { deleteFee, saveFee, setFeePaid, useFees } from "@/fees/feesStore";
import { addMonths, formatEuros, monthKey, overdueFees, suggestedFee, summarizeMonth } from "@/fees/feesModel";
import { hapticSelection, hapticSuccess, hapticTap } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { LOCALE, localDecimal, t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const OTHER = "__other";

/**
 * Participation aux frais d'une demi-pension (Écurie Pro v2) : combien chaque
 * personne verse, mois par mois, et ce qui reste à recevoir. Du suivi, rien
 * de plus — l'app ne fait transiter aucun argent (cf. fees/feesModel.ts).
 */
function HorseFeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { horses } = useHorses();
  const horse = horses.find((h) => h.id === id);
  const rights = useHorseRights();
  const { isPro } = useSubscription();
  const team = useHorseTeam(horse?.id);
  const partnership = useHorseDetails(id)?.partnership ?? null;
  const fees = useFees();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [payer, setPayer] = useState<string>(OTHER);
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");

  const currentMonth = monthKey(new Date());
  const isOwner = !!horse && !horse.sharedRole;
  const canEdit = !!horse && rights.can(horse.id, "manage_fees") && (!isOwner || isPro);
  const horseId = horse?.id ?? null;
  const summary = horseId ? summarizeMonth(fees, horseId, month) : null;
  const rows = fees.filter((f) => f.horseId === id && f.month === month);
  const suggestion = horse ? suggestedFee(partnership, fees, horse.id, month) : null;
  const late = horse ? overdueFees(fees, horse.id, currentMonth) : [];
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  const nameOf = (f: { payerUserId: string | null; payerName: string | null }) =>
    (f.payerUserId ? team.find((m) => m.userId === f.payerUserId)?.name : f.payerName) ?? t("Quelqu'un");

  if (!horse || !summary) {
    return (
      <Screen>
        <View className={`${CARD} items-center`}>
          <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
        </View>
      </Screen>
    );
  }

  function addSuggested() {
    if (!horse || !suggestion) return;
    hapticSuccess();
    animateNextLayout();
    saveFee({ horseId: horse.id, payerUserId: null, payerName: suggestion.payerName, month, amount: suggestion.amount });
    track("fee_added", { source: "partnership" });
  }

  function handleAdd() {
    if (!horse) return;
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const member = payer === OTHER ? null : team.find((m) => m.userId === payer);
    const name = member ? null : payerName.trim();
    if (!member && !name) return;
    hapticSuccess();
    animateNextLayout();
    saveFee({ horseId: horse.id, payerUserId: member?.userId ?? null, payerName: name, month, amount: Math.round(value * 100) / 100 });
    track("fee_added", { source: "manual", account: !!member });
    setAmount("");
    setPayerName("");
    setShowForm(false);
  }

  function confirmDelete(feeId: string, name: string) {
    Alert.alert(t("Supprimer cette ligne ?"), t("La participation de {name} pour {month} sera retirée du suivi.", { name, month: monthLabel }), [
      { text: t("Annuler"), style: "cancel" },
      {
        text: t("Supprimer"),
        style: "destructive",
        onPress: () => {
          animateNextLayout();
          deleteFee(feeId);
        },
      },
    ]);
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="font-display text-2xl tracking-tight text-text" accessibilityRole="header">
              {t("Participation aux frais")}
            </Text>
            <Text className="text-sm text-muted">{horse.name}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      {isOwner && !isPro ? (
        <View className={`${CARD} gap-3`}>
          <Text className="text-base font-semibold text-text">{t("Qui a versé quoi, mois par mois")}</Text>
          <Text className="text-sm text-muted">
            {t("Suis la participation de ta demi-pension et ce qui reste à recevoir. Un simple suivi : l'app ne fait transiter aucun argent. Avec Écurie Pro.")}
          </Text>
          <PrimaryButton label={t("Découvrir Écurie Pro")} onPress={() => router.push("/pro")} />
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => {
            hapticSelection();
            setMonth((m) => addMonths(m, -1));
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
            setMonth((m) => addMonths(m, 1));
          }}
          accessibilityRole="button"
          accessibilityLabel={t("Mois suivant")}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FadeInView delay={40}>
        <View className={`${CARD} gap-1`} accessibilityLiveRegion="polite">
          <Text className="text-sm text-muted">{t("Reste à recevoir")}</Text>
          <Text className="font-display text-3xl tracking-tight text-text">{formatEuros(summary.due, LOCALE)}</Text>
          <Text className="text-sm text-muted">
            {summary.count === 0
              ? t("Rien de saisi ce mois-ci.")
              : t("{paid} reçus sur {total}", { paid: formatEuros(summary.paid, LOCALE), total: formatEuros(summary.total, LOCALE) })}
          </Text>
        </View>
      </FadeInView>

      {late.length > 0 && month === currentMonth ? (
        <View className="flex-row items-start gap-2 rounded-card bg-warning/15 p-4">
          <MaterialCommunityIcons name="alert-outline" size={16} color={colors.warning} />
          <Text className="flex-1 text-sm text-text">
            {late.length === 1
              ? t("1 participation d'un mois passé n'est pas encore reçue.")
              : t("{count} participations de mois passés ne sont pas encore reçues.", { count: late.length })}
          </Text>
        </View>
      ) : null}

      <FadeInView delay={60}>
        <View className="gap-2">
          {rows.length === 0 && !suggestion ? (
            <View className={`${CARD} items-center gap-2`}>
              <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.textMuted} />
              <Text className="text-center text-sm text-muted">
                {canEdit ? t("Aucune participation ce mois-ci. Ajoute la première pour suivre ce qui est versé.") : t("Aucune participation pour ce mois.")}
              </Text>
            </View>
          ) : null}
          {rows.map((f) => (
            <View key={f.id} className="flex-row items-center gap-3 rounded-card bg-surface p-4">
              <TouchableOpacity
                onPress={() => {
                  hapticTap();
                  animateNextLayout();
                  setFeePaid(f.id, !f.paidAt);
                  track("fee_marked", { paid: !f.paidAt });
                }}
                disabled={!canEdit}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!f.paidAt, disabled: !canEdit }}
                accessibilityLabel={t("{name}, {amount}, reçu", { name: nameOf(f), amount: formatEuros(f.amount, LOCALE) })}
                className={`h-7 w-7 items-center justify-center rounded-full ${f.paidAt ? "bg-success" : "border-2 border-border"}`}
              >
                {f.paidAt ? <MaterialCommunityIcons name="check" size={17} color={colors.textOnStatus} /> : null}
              </TouchableOpacity>
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold text-text">{nameOf(f)}</Text>
                <Text className="text-sm text-muted">{f.paidAt ? t("Reçu") : t("À recevoir")}</Text>
              </View>
              <Text className="text-base font-bold text-text">{formatEuros(f.amount, LOCALE)}</Text>
              {canEdit ? (
                <TouchableOpacity onPress={() => confirmDelete(f.id, nameOf(f))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Supprimer")}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {canEdit && suggestion ? (
            <TouchableOpacity
              onPress={addSuggested}
              activeOpacity={0.85}
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-card border border-dashed border-primary p-4"
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
              <Text className="flex-1 text-sm text-text">
                {t("Ajouter la participation de {name} ({amount}) pour ce mois", { name: suggestion.payerName, amount: formatEuros(suggestion.amount, LOCALE) })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </FadeInView>

      {canEdit ? (
        <FadeInView delay={80}>
          {showForm ? (
            <View className={`${CARD} gap-4`}>
              <Text className="text-sm font-bold uppercase tracking-wide text-accent">{t("Nouvelle participation")}</Text>
              <Field label={t("De la part de")}>
                <ChipSelect
                  options={[
                    ...team.filter((m) => m.role !== "OWNER").map((m) => ({ value: m.userId, label: m.name, icon: "account-outline" })),
                    { value: OTHER, label: t("Quelqu'un d'autre"), icon: "account-plus-outline" },
                  ]}
                  value={payer}
                  onChange={(v) => {
                    hapticSelection();
                    setPayer(v);
                  }}
                />
                {payer === OTHER ? (
                  <TextInput className={INPUT} placeholder={t("Son prénom")} placeholderTextColor={colors.textMuted} value={payerName} onChangeText={setPayerName} maxLength={60} accessibilityLabel={t("Son prénom")} />
                ) : null}
              </Field>
              <Field label={t("Montant (€)")}>
                <TextInput className={INPUT} placeholder={localDecimal("150")} placeholderTextColor={colors.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel={t("Montant (€)")} />
              </Field>
              <View className="flex-row gap-2">
                <TouchableOpacity onPress={() => setShowForm(false)} accessibilityRole="button" className="flex-1 items-center rounded-card border border-border p-4">
                  <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
                </TouchableOpacity>
                <View className="flex-1">
                  <PrimaryButton label={t("Ajouter")} disabled={!amount.trim() || (payer === OTHER && !payerName.trim())} onPress={handleAdd} />
                </View>
              </View>
            </View>
          ) : (
            <AddToggle label={t("Ajouter une participation")} onPress={() => setShowForm(true)} color={colors.primary} />
          )}
        </FadeInView>
      ) : null}

      <Text className="text-center text-sm text-muted">{t("Un suivi : l'app ne fait transiter aucun argent entre vous.")}</Text>
    </Screen>
  );
}

/** Écurie Pro n'est pas ouvert dans cette version (cf. lib/features.ts). */
export default function HorseFeesScreenGuard() {
  if (!PRO_ENABLED) return <Redirect href="/" />;
  return <HorseFeesScreen />;
}
