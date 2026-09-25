import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSubscription } from "@/subscription/store";
import { useHorses } from "@/horses/store";
import { ensureNotificationPermission, getNotificationStatus } from "@/lib/notifications";
import { syncTrialLifecycle } from "@/subscription/trialLifecycle";
import { formatDayMonth, formatFullDate, trialReminderDate } from "@/subscription/paywallLogic";
import { track } from "@/lib/analytics";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Écran affiché juste après un achat ou un début d'essai (cf. app/paywall.tsx
 * et (onboarding)/paywall.tsx) : confirme ce qui vient d'être débloqué, dit
 * quand l'essai se termine et quand on préviendra, demande l'autorisation de
 * notification avec une raison concrète, et propose trois premières actions
 * Premium — la conversion essai → abonnement dépend de l'usage pendant l'essai.
 */
export default function PremiumWelcome() {
  const colors = useThemeColors();
  const subscription = useSubscription();
  const { status, trialEndsAt, billingPeriod } = subscription;
  const { horses, selectedHorse } = useHorses();
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  const ownedHorses = horses.filter((h) => !h.sharedRole);
  const horse = selectedHorse && !selectedHorse.sharedRole ? selectedHorse : ownedHorses[0];
  const trialing = status === "trialing" && !!trialEndsAt;
  const end = trialEndsAt ? new Date(trialEndsAt) : null;
  const remindAt = end ? trialReminderDate(end) : null;

  useEffect(() => {
    track("premium_welcome_viewed", { status });
    getNotificationStatus()
      .then(setNotifGranted)
      .catch(() => setNotifGranted(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableNotifications() {
    track("premium_welcome_action", { action: "notifications" });
    const granted = await ensureNotificationPermission().catch(() => false);
    setNotifGranted(granted);
    // Bascule le rappel de fin d'essai de l'email vers la notification.
    if (granted) void syncTrialLifecycle({ status, trialEndsAt, billingPeriod });
  }

  function go(action: string, href: Href) {
    track("premium_welcome_action", { action });
    router.replace(href);
  }

  const actions: { key: string; icon: IconName; title: string; href: Href }[] = [
    ownedHorses.length < 2
      ? { key: "add_horse", icon: "horse-variant", title: "Ajoute tes autres chevaux", href: "/add-horse-modal" }
      : {
          key: "share",
          icon: "account-multiple-outline",
          title: "Invite ta demi-pension ou ton coach",
          href: `/share-horse-modal?horseId=${horse?.id ?? ""}` as Href,
        },
    ...(horse
      ? [
          {
            key: "reminder",
            icon: "bell-ring-outline" as IconName,
            title: `Programme un rappel pour le prochain soin de ${horse.name}`,
            href: `/horse/${horse.id}/sante` as Href,
          },
          {
            key: "document",
            icon: "folder-lock-outline" as IconName,
            title: "Range une ordonnance ou une facture",
            href: `/horse/${horse.id}/documents` as Href,
          },
        ]
      : []),
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="px-5 pt-8 pb-4 gap-6" showsVerticalScrollIndicator={false}>
        <FadeInView>
          <View className="gap-2">
            <Text className="text-3xl font-display leading-tight tracking-tight text-text">Bienvenue dans Premium 🎉</Text>
            <Text className="text-base text-muted">
              {trialing && end
                ? billingPeriod === null
                  ? `Ton essai offert est actif jusqu'au ${formatFullDate(end)}.`
                  : `Ton essai est actif jusqu'au ${formatFullDate(end)}.${
                      remindAt ? ` On te préviendra le ${formatDayMonth(remindAt)}, avant la fin.` : ""
                    }`
                : "Merci ! Toutes les fonctionnalités Premium sont débloquées."}
            </Text>
          </View>
        </FadeInView>

        {notifGranted === false ? (
          <FadeInView delay={100}>
            <View className="gap-3 rounded-card bg-highlight p-4">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="bell-outline" size={20} color={colors.primary} />
                <Text className="flex-1 text-base font-bold text-text">Être prévenu à temps</Text>
              </View>
              <Text className="text-sm text-muted">
                {trialing
                  ? "Active les notifications pour recevoir tes rappels de soins, et notre message avant la fin de l'essai. Sans elles, on te préviendra par email."
                  : "Active les notifications pour recevoir tes rappels de soins avant chaque rendez-vous."}
              </Text>
              <TouchableOpacity onPress={enableNotifications} activeOpacity={0.85} className="self-start rounded-full bg-primary px-5 py-2.5">
                <Text className="text-sm font-bold text-on-primary">Activer les notifications</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
        ) : null}

        <FadeInView delay={180}>
          <View className="gap-3">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Pour bien démarrer</Text>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.key}
                onPress={() => go(a.key, a.href)}
                activeOpacity={0.85}
                className="flex-row items-center gap-3 rounded-card bg-surface p-4 shadow-card"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                  <MaterialCommunityIcons name={a.icon} size={20} color={colors.primary} />
                </View>
                <Text className="flex-1 text-base font-semibold text-text">{a.title}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </FadeInView>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton
          label="C'est parti"
          onPress={() => {
            track("premium_welcome_action", { action: "close" });
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/today");
          }}
        />
      </View>
    </SafeAreaView>
  );
}
