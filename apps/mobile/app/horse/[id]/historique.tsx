import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { BackButton } from "@/components/BackButton";
import { useHorses } from "@/horses/store";
import { useAgenda } from "@/agenda/store";
import { useSessions } from "@/sessions/store";
import { buildActivityEntries } from "@/agenda/activity";
import { ActivityFeed } from "@/agenda/components/ActivityFeed";
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
  const entries = id ? buildActivityEntries(id, { sessions, appointments, journal, expenses }) : [];

  return (
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <View className="flex-row items-center gap-1">
            <BackButton />
            <Text className="text-3xl font-display tracking-tight text-text">{t("Historique")}</Text>
          </View>
          <Text className="text-base text-muted">{t("La vie de ")}{horse?.name ?? t("ce cheval")}{t(", en un coup d'œil")}</Text>
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <ActivityFeed
          entries={entries}
          emptyMessage={t("Rien à afficher pour l'instant : les séances, soins, entrées de journal et dépenses passées de {v} apparaîtront ici.", { v: horse?.name ?? "ce cheval" })}
        />
      </FadeInView>
    </Screen>
  );
}
