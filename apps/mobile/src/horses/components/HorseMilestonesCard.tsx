import { useMemo } from "react";
import { ScrollView, Share, Text, TouchableOpacity, View } from "react-native";
import { useThemeColors } from "@/theme/ThemeProvider";
import { computeMilestones, nextMilestone, type MilestoneInput } from "@/horses/milestones";
import { DOWNLOAD_URL } from "@/lib/links";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Badges du couple (cf. horses/milestones.ts) : le prochain à portée, avec sa
 * progression, et ceux déjà obtenus — chacun se partage d'un toucher.
 */
export function HorseMilestonesCard({ horseName, ...input }: MilestoneInput & { horseName: string }) {
  const colors = useThemeColors();
  const milestones = useMemo(
    () => computeMilestones(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.horseId, input.sessions, input.appointments, input.journal]
  );
  const unlocked = milestones.filter((m) => m.unlocked);
  const next = nextMilestone(milestones);

  function share(title: string, emoji: string) {
    track("milestone_shared", { milestone: title });
    Share.share({
      message: t("{horseName} et moi : {v} {emoji}\nSuivi sur Horsetrack{v2}", { horseName: horseName, v: title.toLowerCase(), emoji: emoji, v2: DOWNLOAD_URL ? ` — ${DOWNLOAD_URL}` : "" }),
    }).catch(() => {});
  }

  return (
    <View className={`${CARD} gap-4`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-text" accessibilityRole="header">
          {t("Badges avec ")}{horseName}
        </Text>
        <Text className="text-sm font-semibold text-muted">
          {unlocked.length}/{milestones.length}
        </Text>
      </View>

      {next ? (
        <View className="gap-2" accessible accessibilityLabel={t("Prochain badge : {title}, {current} sur {target}", { title: next.title, current: next.current, target: next.target })}>
          <View className="flex-row items-center gap-2">
            <Text className="text-lg">{next.emoji}</Text>
            <Text className="flex-1 text-sm font-semibold text-text">{t("Prochain : ")}{next.title}</Text>
            <Text className="text-sm text-muted">
              {next.current}/{next.target}
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-border">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, (next.current / next.target) * 100)}%`, backgroundColor: colors.primary }}
            />
          </View>
        </View>
      ) : (
        <Text className="text-sm text-muted">{t("Tous les badges sont obtenus. Chapeau !")}</Text>
      )}

      {unlocked.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5">
          {unlocked.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => share(m.title, m.emoji)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("{title}, obtenu. Partager", { title: m.title })}
              className="w-20 items-center gap-1.5"
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-highlight">
                <Text className="text-2xl">{m.emoji}</Text>
              </View>
              <Text className="text-center text-[11px] font-semibold leading-[13px] text-text" numberOfLines={2}>
                {m.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text className="text-sm text-muted">{t("Coche ta première séance pour obtenir ton premier badge.")}</Text>
      )}
    </View>
  );
}
