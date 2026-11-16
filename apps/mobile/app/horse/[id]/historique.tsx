import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { SubScreenHeader } from "@/components/SubScreenHeader";
import { useHorses } from "@/horses/store";
import { useAgenda } from "@/agenda/store";
import { useSessions } from "@/sessions/store";
import { buildActivityEntries } from "@/agenda/activity";
import { ActivityFeed } from "@/agenda/components/ActivityFeed";
import { useFreeTier } from "@/subscription/useFreeTier";
import { splitHistory } from "@/subscription/freeTier";
import { OlderHistoryCard } from "@/subscription/OlderHistoryCard";
import { t } from "@/i18n";

/**
 * Historique complet du cheval — version non modale de horse-history-modal.tsx,
 * même logique/rendu partagés (agenda/activity.ts + ActivityFeed, cf. plan
 * Phase 3 Étape 2), atteinte depuis le lien "Voir tout" du Horse Hub.
 */
export default function HorseHistoriqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { appointments, journal, expenses } = useAgenda();
  const { sessions } = useSessions();

  const horse = horses.find((h) => h.id === id);
  const freeTier = useFreeTier();
  const allEntries = id ? buildActivityEntries(id, { sessions, appointments, journal, expenses }) : [];
  // Gratuit resserré : 90 jours affichés, le reste gardé (cf. freeTier.ts).
  // Jamais sur un cheval partagé : son historique est celui du propriétaire.
  const { visible: entries, hiddenCount } = splitHistory(
    allEntries,
    (e) => e.date,
    horse && !horse.sharedRole ? freeTier.historyCutoff : null
  );

  return (
    <Screen>
      <FadeInView>
        <SubScreenHeader title={t("Historique")} subtitle={t("La vie de {name}, en un coup d'œil", { name: horse?.name ?? t("ce cheval") })} />
      </FadeInView>

      <FadeInView delay={80}>
        <ActivityFeed
          entries={entries}
          emptyMessage={t("Rien à afficher pour l'instant : les séances, soins, entrées de journal et dépenses passées de {v} apparaîtront ici.", { v: horse?.name ?? t("ce cheval") })}
        />
      </FadeInView>

      {hiddenCount > 0 ? (
        <FadeInView delay={120}>
          <OlderHistoryCard hiddenCount={hiddenCount} surface="history" horseId={horse?.id} />
        </FadeInView>
      ) : null}
    </Screen>
  );
}
