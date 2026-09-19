import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { Field } from "@/components/Field";
import { ChipSelect } from "@/components/FormChips";
import { amountsForHorses, type AmountMode } from "@/agenda/splitAmount";

/** Montant en euros pour l'aperçu de répartition — virgule décimale, et les
 * centimes seulement quand il y en a (60 € et non 60,00 €). */
function formatEuros(value: number): string {
  return (Math.round(value * 100) % 100 === 0 ? String(Math.round(value)) : value.toFixed(2)).replace(".", ",");
}

/** « Ce montant est… par cheval / à répartir » + aperçu du résultat.
 *
 * Partagé entre le formulaire de dépense et le coût d'un rendez-vous de soin :
 * dès qu'une saisie vise plusieurs chevaux, un même montant a deux lectures
 * légitimes (300 € de pension valent POUR CHACUN, 180 € de déplacement de
 * maréchal sont À RÉPARTIR) et aucune n'est évidente — on demande plutôt que
 * de deviner. Décision produit du 2026-09-19.
 *
 * L'aperçu appelle la MÊME fonction que la soumission (amountsForHorses) : la
 * répartition d'un montant est le seul endroit où l'utilisateur ne peut pas
 * deviner le résultat de tête (100 € sur 3 chevaux ne font pas trois fois
 * 33,33 €), il faut le lui montrer avant qu'il valide. */
export function AmountModeField({
  mode,
  onChange,
  horseCount,
  amount,
  noun = "dépenses",
}: {
  mode: AmountMode;
  onChange: (mode: AmountMode) => void;
  horseCount: number;
  /** Montant saisi, déjà converti en nombre (NaN/≤0 = pas d'aperçu). */
  amount: number;
  /** Ce que la soumission crée, pour l'aperçu (« dépenses », « rendez-vous »). */
  noun?: string;
}) {
  if (horseCount <= 1) return null;
  const preview = Number.isFinite(amount) && amount > 0 ? amountsForHorses(amount, horseCount, mode) : null;

  return (
    <Field label="Ce montant est…">
      <View className="gap-2">
        <ChipSelect
          options={[
            { value: "per-horse" as AmountMode, label: "Par cheval", icon: { name: "content-copy", color: colors.textMuted } },
            { value: "split" as AmountMode, label: "À répartir", icon: { name: "call-split", color: colors.textMuted } },
          ]}
          value={mode}
          onChange={onChange}
        />
        {preview ? (
          <Text className="text-xs text-muted">
            {mode === "split"
              ? `${horseCount} ${noun} de ${preview.map(formatEuros).join(" / ")} €, soit ${formatEuros(amount)} € au total.`
              : `${horseCount} ${noun} de ${formatEuros(amount)} €, soit ${formatEuros(amount * horseCount)} € au total.`}
          </Text>
        ) : null}
      </View>
    </Field>
  );
}
