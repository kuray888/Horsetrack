import { useState } from "react";
import { RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "@/components/AppImage";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Locked } from "@/components/Locked";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses, type Horse } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { useSessions } from "@/sessions/store";
import { HorseHub } from "@/horses/components/HorseHub";
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
  isActive,
  nextSessionLabel,
  nextDueLabel,
  onPress,
}: {
  horse: Horse;
  locked: boolean;
  /** Cheval actuellement sélectionné (cf. horses/store.tsx selectedHorse) —
   * celui qui pilote Planning/Agenda/Journal filtré/Accueil. Distinct de
   * `isPrimary` (l'étoile) : un cheval peut être principal sans être celui
   * actuellement consulté, confusion identifiée à l'audit du 2026-09-16. */
  isActive: boolean;
  nextSessionLabel: string | null;
  nextDueLabel: string | null;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const card = (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} className={`${CARD} flex-row items-center gap-3`}>
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-highlight">
        {horse.photoUrl ? (
          <Image source={{ uri: horse.photoUrl }} style={{ width: 56, height: 56 }} />
        ) : (
          <MaterialCommunityIcons name="horse-variant" size={26} color={colors.primary} />
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="flex-1 text-base font-display-bold text-text" numberOfLines={1}>
            {horse.name}
          </Text>
          {horse.isPrimary ? <MaterialCommunityIcons name="star" size={13} color={colors.warning} /> : null}
          {isActive ? (
            <View className="flex-row items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5">
              <View className="h-1.5 w-1.5 rounded-full bg-primary" />
              <Text className="text-[11px] font-semibold text-primary">Actif</Text>
            </View>
          ) : null}
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
  const { horses, selectedHorse, selectHorse, syncFailed, retrySync } = useHorses();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await retrySync();
    setRefreshing(false);
  }
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
    // Seul endroit où ouvrir une fiche change encore le cheval actif, et
    // volontairement : cet écran EST le sélecteur de cheval — il marque la
    // ligne active (cf. `isActive`), et y toucher une ligne se lit comme
    // « je passe sur ce cheval ». Ailleurs, consulter une fiche laisse le
    // contexte global tel quel (cf. app/horse/[id]/index.tsx).
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
        isActive={horse.id === selectedHorse?.id}
        nextSessionLabel={nextSession ? `Séance ${daysUntilLabel(nextSession.date)} · ${ACTIVITY_META[nextSession.activityType].label}` : null}
        nextDueLabel={nextDue ? `${APPT_META[nextDue.type].label} ${daysUntilLabel(nextDue.nextDueDate!)}` : null}
        onPress={() => openHorse(horse)}
      />
    );
  }

  // Une écurie d'un seul cheval n'a pas de liste à parcourir : cet onglet
  // affichait une ligne unique, qu'il fallait toucher pour atteindre la fiche
  // — deux appuis pour l'écran le plus utilisé de l'app, et un écran
  // intermédiaire qui n'apprenait rien. On rend la fiche directement.
  //
  // Rendu du composant, PAS une redirection : un écran qui redirige à son
  // montage (même via <Redirect>) plantait en TestFlight — cf.
  // horses/horseHubNavigation.test.ts et l'ancien horse/[id]/entrainement.tsx.
  //
  // Dès deux chevaux (partagé compris), la liste reprend sa place : c'est là
  // qu'elle sert, et elle reste le sélecteur de cheval actif de l'app.
  if (horses.length === 1) {
    return <HorseHub horseId={horses[0].id} inTab />;
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <FadeInView>
        <Text className="text-3xl font-display tracking-tight text-text">Chevaux</Text>
      </FadeInView>

      {/* Cf. audit du 2026-09-16 : avant, un échec de synchro n'était visible
          que dans les logs — glisse vers le bas pour retenter. */}
      {syncFailed ? (
        <FadeInView delay={20}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5">
            <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">
              Certaines modifications ne sont pas encore synchronisées.
            </Text>
            <TouchableOpacity onPress={onRefresh} hitSlop={8}>
              <Text className="text-sm font-bold text-warning">Réessayer</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}

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
      ) : (
        <FadeInView delay={40}>
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="horse-variant" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-center text-sm text-muted">
              Aucun cheval pour l&apos;instant — ajoute le premier ci-dessous.
            </Text>
          </View>
        </FadeInView>
      )}

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
