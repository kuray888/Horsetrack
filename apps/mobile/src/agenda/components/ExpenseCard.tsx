import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import { Locked } from "@/components/Locked";
import type { Appointment, Doc, Expense } from "@/agenda/store";
import { EXPENSE_META, formatAmount } from "@/agenda/meta";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export function ExpenseCard({
  expense,
  linkedAppointment,
  linkedDocument,
  onDelete,
  onEdit,
  onTogglePaid,
  onAttachReceipt,
  onRemoveReceipt,
}: {
  expense: Expense;
  linkedAppointment: Appointment | null;
  linkedDocument: Doc | null;
  onDelete: () => void;
  onEdit: () => void;
  onTogglePaid: () => void;
  onAttachReceipt: () => void;
  onRemoveReceipt: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = EXPENSE_META[expense.category];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded((v) => !v)} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{meta.label}</Text>
          <Text className="text-sm text-muted">{formatDate(expense.date)}</Text>
        </View>
        <View className="items-end gap-0.5">
          <Text className="text-base font-extrabold text-text">{formatAmount(expense.amount, expense.currency)}</Text>
          <Text className={`text-xs font-semibold ${expense.isPaid ? "text-success" : "text-muted"}`}>
            {expense.isPaid ? "Payé" : "À régler"}
          </Text>
        </View>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {expense.notes ? <Text className="text-sm text-muted">{expense.notes}</Text> : null}
          {linkedAppointment ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="link-variant" size={15} color={colors.textMuted} />
              <Text className="text-sm text-text">
                Lié à {linkedAppointment.title} ({formatDate(linkedAppointment.date)})
              </Text>
            </View>
          ) : null}
          {expense.documentId ? (
            linkedDocument ? (
              <View className="flex-row items-center justify-between gap-1.5">
                <View className="flex-1 flex-row items-center gap-1.5">
                  <MaterialCommunityIcons name="receipt" size={15} color={colors.textMuted} />
                  <Text className="text-sm text-text">Reçu : {linkedDocument.name}</Text>
                </View>
                <TouchableOpacity onPress={onRemoveReceipt} hitSlop={8} activeOpacity={0.7}>
                  <Text className="text-sm font-semibold text-danger">Retirer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name="lock-outline" size={15} color={colors.textMuted} />
                <Text className="text-sm text-muted">Reçu non disponible</Text>
              </View>
            )
          ) : (
            <Locked message="Joindre une facture réservé à l'abonnement Premium (coffre-fort)">
              <TouchableOpacity onPress={onAttachReceipt} activeOpacity={0.7} className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name="paperclip" size={15} color={colors.accent} />
                <Text className="text-sm font-semibold text-accent">Joindre une facture</Text>
              </TouchableOpacity>
            </Locked>
          )}
          <Locked message="Basculer le statut payé/à régler réservé à l'abonnement Premium">
            <TouchableOpacity onPress={onTogglePaid} activeOpacity={0.7} className="mt-1">
              <Text className="text-sm font-semibold text-accent">
                {expense.isPaid ? "Marquer à régler" : "Marquer payée"}
              </Text>
            </TouchableOpacity>
          </Locked>
          <View className="mt-1 flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => {
                setExpanded(false);
                onEdit();
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-semibold text-accent">Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-danger">Supprimer cette dépense</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
