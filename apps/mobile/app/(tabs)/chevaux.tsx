import { Image, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Locked } from "@/components/Locked";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses, type Horse } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { APPT_META, daysUntilLabel } from "@/agenda/meta";
import { findNextSession, findNextDue } from "@/agenda/upcoming";
import { DISCIPLINES, HORSE_LEVELS } from "@/onboarding/options";

const CARD = "rounded-card bg-surface p-5 shadow-card";

function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function HorseRow({
  horse,
  locked,
  nextSessionLabel,
  nextDueLabel,
  onPress,
}: {
  horse: Horse;
  locked: boolean;
  nextSessionLabel: string | null;
  nextDueLabel: string | null;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const card = (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} className={`${CARD} flex-row items-center gap-3`}>
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-highlight">
        {horse.photoUrl ? (
          <Image source={{ uri: horse.photoUrl }} className="h-14 w-14" />
        ) : (
          <MaterialCommunityIcons name="horse-variant" size={26} color={colors.primary} />
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-base font-display-bold text-text">{horse.name}</Text>
          {horse.isPrimary ? <MaterialCommunityIcons name="star" size={13} color={colors.warning} /> : null}
          {horse.sharedRole ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5">
              <MaterialCommunityIcons name="handshake-outline" size={11} color={colors.accent} />
              <Text className="text-[11px] font-semibold text-accent">Partagé</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-sm text-muted">
          {labelOf(DISCIPLINES, horse.discipline)} · {labelOf(HORSE_LEVELS, horse.level)}
        </Text>
        {nextSessionLabel ? <Text className="text-xs text-muted">{nextSessionLabel}</Text> : null}
        {nextDueLabel ? <Text className="text-xs font-semibold text-accent">{nextDueLabel}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
  return locked ? (
    <Locked message="Débloque ce cheval avec Horsetrack Premium">{card}</Locked>
  ) : (
    card
  );
}

export default function ChevauxScreen() {
  const colors = useThemeColors();
  const { horses, selectHorse } = useHorses();
  const subscription = useSubscription();
  const horseLimit = maxHorses(subscription);
  const { sessions } = useSessions();
  const { appointments } = useAgenda();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Chevaux possédés et partagés (DP/coach) toujours séparés — un cheval
  // partagé ne compte jamais dans le quota du palier (cf. horses/store.tsx,
  // même règle que profile.tsx/today.tsx).
  const ownedHorses = horses.filter((h) => !h.sharedRole);
  const sharedHorses = horses.filter((h) => h.sharedRole);

  function openHorse(horse: Horse) {
    // Le Horse Hub (app/horse/[id]/index.tsx) re-sélectionne aussi ce cheval
    // à son montage (même garantie), mais on le fait déjà ici pour que le
    // contexte global soit cohérent dès la navigation, sans attendre un
    // aller-retour de rendu.
    selectHorse(horse.id);
    router.push(`/horse/${horse.id}`);
  }

  function rowFor(horse: Horse, locked: boolean) {
    const nextSession = findNextSession(sessions, horse.id, todayStart);
    const nextDue = findNextDue(appointments, horse.id, todayStart);
    return (
      <HorseRow
        horse={horse}
        locked={locked}
        nextSessionLabel={nextSession ? `Séance ${daysUntilLabel(nextSession.date)} · ${ACTIVITY_META[nextSession.activityType].label}` : null}
        nextDueLabel={nextDue ? `${APPT_META[nextDue.type].label} ${daysUntilLabel(nextDue.nextDueDate!)}` : null}
        onPress={() => openHorse(horse)}
      />
    );
  }

  return (
    <Screen>
      <FadeInView>
        <Text className="text-3xl font-display tracking-tight text-text">Chevaux</Text>
      </FadeInView>

      {ownedHorses.length > 0 ? (
        <>
          <FadeInView delay={40}>
            <Text className="text-sm font-bold uppercase tracking-wide text-muted">Mes chevaux</Text>
          </FadeInView>
          {ownedHorses.map((horse, i) => (
            <FadeInView key={horse.id} delay={80 + i * 60}>
              {rowFor(horse, i >= horseLimit)}
            </FadeInView>
          ))}
        </>
      ) : null}

      <FadeInView delay={120}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/add-horse-modal")}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
          <Text className="text-base font-semibold text-primary">Ajouter un cheval</Text>
        </TouchableOpacity>
      </FadeInView>

      {sharedHorses.length > 0 ? (
        <>
          <FadeInView delay={160}>
            <Text className="text-sm font-bold uppercase tracking-wide text-muted">Partagés avec moi</Text>
          </FadeInView>
          {sharedHorses.map((horse, i) => (
            <FadeInView key={horse.id} delay={200 + i * 60}>
              {rowFor(horse, false)}
            </FadeInView>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
