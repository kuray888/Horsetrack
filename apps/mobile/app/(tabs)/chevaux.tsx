import { useState } from "react";
import { RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { Link, router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Locked } from "@/components/Locked";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses, type Horse } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { useSessions } from "@/sessions/store";
import { HorseHub } from "@/horses/components/HorseHub";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { APPT_META, daysUntilLabel } from "@/agenda/meta";
import { findNextSession, findNextDue } from "@/agenda/upcoming";
import { useCloudRefresh } from "@/lib/cloudRefresh";
import { DISCIPLINES, HORSE_LEVELS } from "@/onboarding/options";
import { lazyTab } from "@/components/LazyTab";
import { ScreenTitle } from "@/components/ScreenTitle";
import { QuickAddSheet, openQuickAddFromTab } from "@/components/QuickAddSheet";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Ouvre le formulaire de séance du Planning. `ts` rend chaque demande
 * unique (cf. planning.tsx, qui reste monté entre deux visites). */
function openSessionForm() {
  router.navigate({ pathname: "/(tabs)/planning", params: { openForm: "session", ts: String(Date.now()) } });
}

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
  onPlanSession,
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
  /** Appelé juste avant d'ouvrir la fiche (la navigation, elle, passe par le
   * `Link`, qui porte la transition zoom). */
  onPress: () => void;
  onPlanSession: () => void;
}) {
  const colors = useThemeColors();
  const avatar = (
    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-highlight">
      {horse.photoUrl ? (
        <Image source={{ uri: horse.photoUrl }} style={{ width: 56, height: 56 }} />
      ) : (
        <MaterialCommunityIcons name="horse-variant" size={26} color={colors.primary} />
      )}
    </View>
  );
  const row = (onRowPress?: () => void) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onRowPress}
      accessibilityRole="button"
      accessibilityLabel={t("Ouvrir la fiche de {name}", { name: horse.name })}
      accessibilityHint={locked ? undefined : t("Appui long pour plus d'actions")}
      className={`${CARD} flex-row items-center gap-3`}
    >
      {/* Source de la transition zoom (iOS 18+) : la photo ronde grandit
          jusqu'à devenir la bannière de la fiche (cf. HorseBanner). Hors
          d'un Link (cheval verrouillé), un simple affichage. */}
      {locked ? avatar : <Link.AppleZoom>{avatar}</Link.AppleZoom>}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="flex-1 text-base font-display-bold text-text" numberOfLines={1}>
            {horse.name}
          </Text>
          {horse.isPrimary ? <MaterialCommunityIcons name="star" size={13} color={colors.warning} /> : null}
          {isActive ? (
            <View className="flex-row items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5">
              <View className="h-1.5 w-1.5 rounded-full bg-primary" />
              <Text className="text-[11px] font-semibold text-primary">{t("Actif")}</Text>
            </View>
          ) : null}
          {horse.sharedRole ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5">
              <MaterialCommunityIcons name="handshake-outline" size={11} color={colors.accent} />
              <Text className="text-[11px] font-semibold text-accent">{t("Partagé")}</Text>
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
  if (locked) {
    return (
      <Locked message={t("Retrouve ce cheval avec Premium : ses données sont conservées")} placement="horses" feature="locked_horse" horseId={horse.id}>
        {/* Pas de Link ici : le verrou rend la ligne inerte, mais la laisse
            telle quelle si l'abonnement se confirme entre-temps — elle doit
            alors ouvrir la fiche par elle-même. */}
        {row(() => {
          onPress();
          router.push(`/horse/${horse.id}`);
        })}
      </Locked>
    );
  }
  const isOwner = !horse.sharedRole;
  // Appui long : menu natif iOS (ailleurs, l'appui simple reste le seul
  // geste et ouvre la fiche comme avant). Les actions reprennent des écrans
  // existants, sans nouveau flux.
  return (
    <Link href={`/horse/${horse.id}`} asChild onPress={onPress}>
      <Link.Trigger>{row()}</Link.Trigger>
      <Link.Menu title={horse.name}>
        <Link.MenuAction icon="calendar.badge.plus" onPress={onPlanSession}>
          {t("Planifier une séance")}
        </Link.MenuAction>
        {isOwner ? (
          <Link.MenuAction icon="pencil" onPress={() => router.push(`/edit-horse-modal?id=${horse.id}`)}>
            {t("Modifier")}
          </Link.MenuAction>
        ) : null}
        {isOwner ? (
          <Link.MenuAction icon="person.2" onPress={() => router.push(`/share-horse-modal?horseId=${horse.id}`)}>
            {t("Partager l'accès")}
          </Link.MenuAction>
        ) : null}
      </Link.Menu>
    </Link>
  );
}

function ChevauxScreen() {
  const colors = useThemeColors();
  const { horses, selectedHorse, selectHorse, syncFailed, retrySync } = useHorses();
  const [refreshing, setRefreshing] = useState(false);
  // Même « + » que partout (cf. components/QuickAddSheet.tsx), avec ici
  // « Un cheval » en tête : c'est l'ajout le plus attendu sur cet onglet.
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const { refresh: refreshFromCloud } = useCloudRefresh();
  // Tirer pour rafraîchir : envoie d'abord l'écurie locale, puis relit le
  // serveur (nouveaux chevaux partagés, modifications faites ailleurs).
  async function onRefresh() {
    setRefreshing(true);
    await retrySync();
    await refreshFromCloud();
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
  }

  function planSessionFor(horse: Horse) {
    // Même chemin que « Planifier une séance » de l'Accueil : le Planning
    // ouvre son formulaire pour le cheval actif, qu'on pose donc d'abord.
    selectHorse(horse.id);
    openSessionForm();
  }

  function rowFor(horse: Horse, locked: boolean) {
    const nextSession = findNextSession(sessions, horse.id, todayStart);
    const nextDue = findNextDue(appointments, horse.id, todayStart);
    return (
      <HorseRow
        horse={horse}
        locked={locked}
        isActive={horse.id === selectedHorse?.id}
        nextSessionLabel={nextSession ? t("Séance {daysUntilLabel} · {label}", { daysUntilLabel: daysUntilLabel(nextSession.date), label: ACTIVITY_META[nextSession.activityType].label }) : null}
        nextDueLabel={nextDue ? `${APPT_META[nextDue.type].label} ${daysUntilLabel(nextDue.nextDueDate!)}` : null}
        onPress={() => openHorse(horse)}
        onPlanSession={() => planSessionFor(horse)}
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
    <>
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <FadeInView>
        <ScreenTitle title={t("Chevaux")} onAdd={() => setQuickAddVisible(true)} addLabel={t("Ajouter")} />
      </FadeInView>

      {/* Cf. audit du 2026-09-16 : avant, un échec de synchro n'était visible
          que dans les logs — glisse vers le bas pour retenter. */}
      {syncFailed ? (
        <FadeInView delay={20}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5">
            <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">
              {t("Certaines modifications ne sont pas encore synchronisées.")}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={onRefresh} hitSlop={8}>
              <Text className="text-sm font-bold text-warning">{t("Réessayer")}</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}

      {ownedHorses.length > 0 ? (
        <>
          <FadeInView delay={40}>
            <Text className="text-sm font-bold uppercase tracking-wide text-muted">{t("Mes chevaux")}</Text>
          </FadeInView>
          {/* Retour au palier gratuit (fin d'essai, résiliation) : les chevaux
              au-delà du premier restent là, verrouillés. On dit explicitement
              que rien n'est perdu — c'est vrai, et c'est ce qui inquiète. */}
          {!subscription.loading && ownedHorses.length > horseLimit ? (
            <FadeInView delay={60}>
              <TouchableOpacity accessibilityRole="button"
                onPress={() => openPaywall("horses", { feature: "locked_horses_banner" })}
                activeOpacity={0.85}
                className="flex-row items-center gap-3 rounded-card bg-highlight p-4"
              >
                <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.primary} />
                <Text className="flex-1 text-sm text-text">
                  {t("Tes autres chevaux sont conservés, avec toutes leurs données. Premium te permet de les retrouver.")}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </FadeInView>
          ) : null}
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
              {t("Aucun cheval pour l'instant.")}
            </Text>
            {/* L'écurie vide garde un bouton explicite en plus du « + » du
                titre : c'est la toute première action à faire. */}
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/add-horse-modal")} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-accent">{t("Ajouter mon premier cheval")}</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      )}

      {sharedHorses.length > 0 ? (
        <>
          <FadeInView delay={160}>
            <Text className="text-sm font-bold uppercase tracking-wide text-muted">{t("Partagés avec moi")}</Text>
          </FadeInView>
          {sharedHorses.map((horse, i) => (
            <FadeInView key={horse.id} delay={200 + i * 60}>
              {rowFor(horse, false)}
            </FadeInView>
          ))}
        </>
      ) : null}
    </Screen>
    <QuickAddSheet
      visible={quickAddVisible}
      withHorse
      onClose={() => setQuickAddVisible(false)}
      onSelect={(option) => {
        setQuickAddVisible(false);
        openQuickAddFromTab(option);
      }}
    />
    </>
  );
}

export default lazyTab(ChevauxScreen);
