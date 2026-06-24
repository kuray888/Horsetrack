import { useState } from "react";
import { Animated, View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import type { SubscriptionPlan } from "@/subscription/store";

const PLANS: { id: SubscriptionPlan; title: string; price: string; sub: string; badge?: string }[] = [
  {
    id: "ANNUAL",
    title: "Annuel",
    price: "129 €/an",
    sub: "soit 10,75 €/mois · économise 37 %",
    badge: "Le plus choisi",
  },
  { id: "MONTHLY", title: "Mensuel", price: "16,99 €/mois", sub: "sans engagement" },
];

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Text className="text-base text-success">✓</Text>
      <Text className="flex-1 text-[15px] text-text">{text}</Text>
    </View>
  );
}

function PlanCard({
  plan,
  active,
  onPress,
}: {
  plan: (typeof PLANS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`rounded-card border p-4 ${active ? "border-primary bg-highlight" : "border-border bg-surface"}`}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-text">{plan.title}</Text>
          {plan.badge ? (
            <View className="rounded-full bg-primary px-2.5 py-1">
              <Text className="text-xs font-bold text-on-primary">{plan.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-xl font-extrabold text-primary">{plan.price}</Text>
        <Text className="text-sm text-muted">{plan.sub}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Vue du paywall, réutilisée par l'onboarding et le paywall accessible depuis l'app
 * (déclenché par <Locked>). Purement présentationnelle : la logique d'achat est
 * injectée via `onSubscribe`. `onClose` optionnel = paywall skippable (mode gaté).
 */
export function PaywallView({
  onSubscribe,
  onClose,
  onRestore,
  submitting = false,
  restoring = false,
  title = "7 jours offerts, puis tu décides.",
}: {
  onSubscribe: (plan: SubscriptionPlan) => void;
  onClose?: () => void;
  onRestore: () => void;
  submitting?: boolean;
  restoring?: boolean;
  title?: string;
}) {
  const [selected, setSelected] = useState<SubscriptionPlan>("ANNUAL");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {onClose ? (
        <View className="flex-row justify-end px-5 pt-2">
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text className="text-xl text-muted">✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerClassName="px-5 pt-6 pb-4 gap-5" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-3xl font-extrabold leading-tight tracking-tight text-text">{title}</Text>
          <Text className="text-base text-muted">
            Accès complet. Annulable à tout moment avant la fin de l&apos;essai.
          </Text>
        </View>

        <View className="gap-2.5 rounded-card bg-surface p-5 shadow-card">
          <Bullet text="Programme d'entraînement personnalisé" />
          <Bullet text="Chevaux illimités — toute ton écurie" />
          <Bullet text="Julien, ton coach IA, disponible 24/7" />
          <Bullet text="Suivi santé, planning & objectifs" />
        </View>

        <View className="gap-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} active={selected === plan.id} onPress={() => setSelected(plan.id)} />
          ))}
        </View>
      </ScrollView>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={submitting ? "Un instant…" : "Commencer mes 7 jours gratuits"}
          disabled={submitting}
          onPress={() => onSubscribe(selected)}
        />
        <Text className="text-center text-xs leading-4 text-muted">
          Essai gratuit de 7 jours, puis {selected === "ANNUAL" ? "129 €/an" : "16,99 €/mois"}.
          Renouvellement automatique, résiliable à tout moment dans les réglages.
        </Text>
        <View className="flex-row justify-center gap-5">
          <TouchableOpacity onPress={onRestore} disabled={restoring}>
            <Text className="text-xs font-semibold text-accent">
              {restoring ? "Restauration…" : "Restaurer mes achats"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/cgu`)}>
            <Text className="text-xs font-semibold text-accent">Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/confidentialite`)}>
            <Text className="text-xs font-semibold text-accent">Confidentialité</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
