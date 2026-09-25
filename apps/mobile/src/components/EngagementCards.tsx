import { useEffect, useMemo, useState } from "react";
import { Share, Text, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { track } from "@/lib/analytics";
import { DOWNLOAD_URL } from "@/lib/links";
import { recordPositiveMoment } from "@/lib/reviewPrompt";
import {
  monthName,
  previousMonthRecap,
  recapLines,
  recapShareText,
  shouldShowMonthlyRecap,
} from "@/lib/progress";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Lit/écrit un drapeau de fermeture — `undefined` tant que la lecture n'a
 * pas répondu, pour ne jamais faire clignoter une carte déjà fermée. */
function useDismissed(key: string): [boolean | undefined, () => void] {
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(key)
      .then((v) => !cancelled && setDismissed(v === "1"))
      .catch(() => !cancelled && setDismissed(false));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return [
    dismissed,
    () => {
      setDismissed(true);
      SecureStore.setItemAsync(key, "1").catch(() => {});
    },
  ];
}

// --- Premiers pas -----------------------------------------------------------

/**
 * Carte « Premiers pas » de l'Accueil : trois actions qui font découvrir ce
 * que l'app apporte dès le premier jour (photo du cheval, première séance,
 * premier rendez-vous santé). Chaque étape se coche d'elle-même quand elle
 * est faite ; la carte disparaît une fois tout fait, ou si on la ferme.
 */
export function FirstStepsCard({
  horseName,
  hasPhoto,
  hasSession,
  hasHealthAppointment,
  onAddPhoto,
  onPlanSession,
  onAddHealthAppointment,
}: {
  horseName: string;
  hasPhoto: boolean;
  hasSession: boolean;
  hasHealthAppointment: boolean;
  onAddPhoto: () => void;
  onPlanSession: () => void;
  onAddHealthAppointment: () => void;
}) {
  const colors = useThemeColors();
  const [dismissed, dismiss] = useDismissed("first_steps_dismissed_v1");

  const steps: { key: string; done: boolean; icon: IconName; label: string; onPress: () => void }[] = [
    { key: "photo", done: hasPhoto, icon: "camera-outline", label: `Ajoute une photo de ${horseName}`, onPress: onAddPhoto },
    { key: "session", done: hasSession, icon: "horse-variant", label: "Planifie ta première séance", onPress: onPlanSession },
    {
      key: "health",
      done: hasHealthAppointment,
      icon: "needle",
      label: "Note le prochain véto, maréchal ou vaccin",
      onPress: onAddHealthAppointment,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed !== false || doneCount === steps.length) return null;

  return (
    <FadeInView delay={57}>
      <View className="gap-3 rounded-card bg-surface p-4 shadow-card">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm font-bold uppercase tracking-wide text-accent">
            Premiers pas · {doneCount}/{steps.length}
          </Text>
          <TouchableOpacity
            onPress={() => {
              track("first_steps_dismissed", { done: doneCount });
              dismiss();
            }}
            hitSlop={12}
            accessibilityLabel="Masquer les premiers pas"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.key}
            disabled={step.done}
            onPress={() => {
              track("first_steps_action", { step: step.key });
              step.onPress();
            }}
            activeOpacity={0.8}
            className="flex-row items-center gap-3"
            accessibilityRole="button"
            accessibilityState={{ checked: step.done }}
          >
            <View
              className={`h-8 w-8 items-center justify-center rounded-full ${step.done ? "bg-success/15" : "bg-highlight"}`}
            >
              <MaterialCommunityIcons
                name={step.done ? "check" : step.icon}
                size={16}
                color={step.done ? colors.success : colors.primary}
              />
            </View>
            <Text className={`flex-1 text-[15px] ${step.done ? "text-muted line-through" : "font-semibold text-text"}`}>
              {step.label}
            </Text>
            {!step.done ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} /> : null}
          </TouchableOpacity>
        ))}
      </View>
    </FadeInView>
  );
}

// --- Bilan du mois ----------------------------------------------------------

type SessionLike = { horseId: string | null; date: Date; completed: boolean; durationMinutes: number | null };
type AppointmentLike = { horseId: string | null; date: Date; type: string };

/**
 * « Septembre avec Tornado » : bilan du mois écoulé, affiché la première
 * semaine du mois suivant, partageable (texte + lien de téléchargement).
 * Célèbre la régularité, et chaque partage fait connaître l'app.
 */
export function MonthlyRecapCard({
  horseId,
  horseName,
  sessions,
  appointments,
}: {
  horseId: string;
  horseName: string;
  sessions: SessionLike[];
  appointments: AppointmentLike[];
}) {
  const colors = useThemeColors();
  const recap = useMemo(() => previousMonthRecap(sessions, appointments, horseId), [sessions, appointments, horseId]);
  const [dismissed, dismiss] = useDismissed(`monthly_recap_${recap.year}_${recap.month}_${horseId}`);

  if (dismissed !== false || !shouldShowMonthlyRecap(recap)) return null;

  async function share() {
    track("monthly_recap_shared", { sessions: recap.sessionsDone });
    try {
      const result = await Share.share({ message: recapShareText(recap, horseName, DOWNLOAD_URL) });
      if (result.action === Share.sharedAction) recordPositiveMoment("recap_shared");
    } catch {
      // partage annulé ou indisponible : rien à signaler
    }
  }

  return (
    <FadeInView delay={57}>
      <View className="gap-3 rounded-card bg-primary p-5">
        <View className="flex-row items-start gap-2">
          <View className="flex-1 gap-0.5">
            <Text className="text-xs font-bold uppercase tracking-wide text-on-primary/80">Ton bilan du mois</Text>
            <Text className="text-xl font-display text-on-primary">
              {monthName(recap.month)} avec {horseName}
            </Text>
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={12} accessibilityLabel="Masquer le bilan" accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={18} color={colors.textOnPrimary} accessibilityElementsHidden />
          </TouchableOpacity>
        </View>
        <View className="gap-1">
          {recapLines(recap).map((line) => (
            <Text key={line} className="text-[15px] text-on-primary">
              • {line}
            </Text>
          ))}
        </View>
        <TouchableOpacity
          onPress={share}
          activeOpacity={0.85}
          className="flex-row items-center gap-2 self-start rounded-full bg-on-primary/15 px-4 py-2"
        >
          <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.textOnPrimary} />
          <Text className="text-sm font-bold text-on-primary">Partager</Text>
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}

