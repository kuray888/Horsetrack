import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { formatDate } from "@/lib/dateFormat";
import { authorLabel, relativeTime, type Comment } from "@/community/model";
import { fetchHorseFeed, isHorseShared, myUserId } from "@/community/api";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-4 shadow-card";

/**
 * Fil d'un cheval : les derniers échanges sur ses séances et ses souvenirs,
 * entre le propriétaire et les personnes avec qui il est partagé. Toucher
 * un échange ouvre son fil complet.
 */
export default function HorseFeedScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const { journal } = useAgenda();
  const horse = horses.find((h) => h.id === id) ?? null;
  const [feed, setFeed] = useState<Comment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [shared, setShared] = useState<boolean | null>(null);

  useEffect(() => {
    if (!horse) return;
    let cancelled = false;
    Promise.all([fetchHorseFeed(horse.id), myUserId(), isHorseShared(horse.id, horse.sharedRole)]).then(([f, user, isShared]) => {
      if (cancelled) return;
      setFeed(f);
      setFailed(!f);
      setMe(user);
      setShared(isShared);
    });
    return () => {
      cancelled = true;
    };
  }, [horse]);

  if (!horse) {
    return (
      <Screen>
        <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
      </Screen>
    );
  }

  const targetLabel = (c: Comment) => {
    if (c.targetType === "session") {
      const s = sessions.find((x) => x.id === c.targetId);
      return s ? `${s.customActivityLabel || ACTIVITY_META[s.activityType].label} · ${formatDate(s.date)}` : t("Séance");
    }
    const j = journal.find((x) => x.id === c.targetId);
    return j ? `${t("Souvenir")} · ${formatDate(j.date)}` : t("Souvenir");
  };

  return (
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
            {t("Fil de {name}", { name: horse.name })}
          </Text>
          <Text className="text-sm text-muted">
            {t("Commentaires et réactions sur ses séances et ses souvenirs, entre toi et les personnes qui le suivent.")}
          </Text>
        </View>
      </FadeInView>

      {shared === false ? (
        <View className={`${CARD} gap-2`}>
          <Text className="text-sm text-text">
            {t("Personne d'autre ne suit ce cheval pour l'instant. Partage-le avec ta demi-pension ou ton coach pour échanger ici.")}
          </Text>
          {!horse.sharedRole ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/share-horse-modal?horseId=${horse.id}`)}>
              <Text className="text-sm font-semibold text-accent">{t("Partager l'accès")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {feed === null && !failed ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : failed ? (
        <Text className="text-sm text-muted">{t("Le fil n'a pas pu être chargé. Vérifie ta connexion.")}</Text>
      ) : feed!.length === 0 ? (
        <Text className="text-sm text-muted">{t("Pas encore d'échange. Ouvre une séance ou un souvenir et touche « Commentaires ».")}</Text>
      ) : (
        feed!.map((c) => (
          <TouchableOpacity
            key={c.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: "/comments", params: { horseId: horse.id, targetType: c.targetType, targetId: c.targetId } })
            }
            activeOpacity={0.85}
            className={`${CARD} gap-1`}
          >
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name={c.targetType === "session" ? "horse-variant" : "notebook-outline"} size={14} color={colors.textMuted} />
              <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
                {targetLabel(c)}
              </Text>
              <Text className="text-xs text-muted">{relativeTime(c.createdAt)}</Text>
            </View>
            <Text className="text-[15px] leading-5 text-text" numberOfLines={3}>
              <Text className="font-semibold text-primary">{authorLabel(c, me)} · </Text>
              {c.body}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </Screen>
  );
}
