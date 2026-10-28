import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META } from "@/agenda/store";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import {
  COMMENT_MAX,
  authorLabel,
  canDelete,
  cleanCommentBody,
  reactionSummary,
  relativeTime,
  type Comment,
  type Reaction,
  type TargetType,
} from "@/community/model";
import { deleteComment, fetchThread, myUserId, postComment, reportComment, toggleReaction } from "@/community/api";
import { formatDate } from "@/lib/dateFormat";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-4 shadow-card";

function close() {
  if (router.canGoBack()) router.back();
  else router.dismissTo("/(tabs)/today");
}

/**
 * Fil d'une séance ou d'un souvenir : entre le propriétaire et les personnes
 * avec qui le cheval est partagé. Réactions, commentaires, suppression (son
 * commentaire, ou tout le fil pour le propriétaire) et signalement.
 */
export default function CommentsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ horseId?: string; targetType?: string; targetId?: string }>();
  const horseId = params.horseId ?? "";
  const targetType: TargetType = params.targetType === "journal" ? "journal" : "session";
  const targetId = params.targetId ?? "";
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const { journal } = useAgenda();
  const horse = horses.find((h) => h.id === horseId) ?? null;
  const iOwn = !!horse && !horse.sharedRole;

  const [me, setMe] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const target =
    targetType === "session"
      ? (() => {
          const s = sessions.find((x) => x.id === targetId);
          return s ? `${s.customActivityLabel || ACTIVITY_META[s.activityType].label} · ${formatDate(s.date)}` : null;
        })()
      : (() => {
          const j = journal.find((x) => x.id === targetId);
          return j ? `${t("Souvenir")} · ${formatDate(j.date)}` : null;
        })();

  const load = useCallback(async () => {
    const [user, thread] = await Promise.all([myUserId(), fetchThread(horseId, targetType, targetId)]);
    setMe(user);
    setFailed(!thread);
    if (thread) {
      animateNextLayout();
      setComments(thread.comments);
      setReactions(thread.reactions);
    }
  }, [horseId, targetType, targetId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([myUserId(), fetchThread(horseId, targetType, targetId)]).then(([user, thread]) => {
      if (cancelled) return;
      setMe(user);
      setFailed(!thread);
      if (thread) {
        setComments(thread.comments);
        setReactions(thread.reactions);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [horseId, targetType, targetId]);

  async function send() {
    const body = cleanCommentBody(text);
    if (!body || sending) return;
    setSending(true);
    const posted = await postComment(horseId, targetType, targetId, body);
    setSending(false);
    if (!posted) {
      Alert.alert(t("Envoi impossible"), t("Vérifie ta connexion et réessaie."));
      return;
    }
    hapticTap();
    animateNextLayout();
    setText("");
    setComments((list) => [...(list ?? []), posted]);
    track("comment_posted", { target: targetType });
  }

  async function react(emoji: Reaction["emoji"]) {
    const existing = reactions.find((r) => r.emoji === emoji && r.userId === me);
    hapticTap();
    if (await toggleReaction(horseId, targetType, targetId, emoji, existing)) {
      if (!existing) track("reaction_added", { emoji });
      await load();
    }
  }

  function openActions(c: Comment) {
    const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
    if (canDelete(c, me, iOwn)) {
      buttons.push({
        text: t("Supprimer"),
        style: "destructive",
        onPress: async () => {
          if (await deleteComment(c.id)) setComments((list) => (list ?? []).filter((x) => x.id !== c.id));
        },
      });
    }
    if (c.authorUserId !== me) {
      buttons.push({
        text: t("Signaler"),
        onPress: () =>
          Alert.alert(t("Signaler ce commentaire ?"), t("Horsetrack le relira sous 24 h et le supprimera s'il est abusif."), [
            { text: t("Annuler"), style: "cancel" },
            {
              text: t("Signaler"),
              style: "destructive",
              onPress: async () => {
                const ok = await reportComment(c.id, "");
                track("comment_reported");
                Alert.alert(ok ? t("Merci, c'est signalé.") : t("Envoi impossible"), ok ? undefined : t("Vérifie ta connexion et réessaie."));
              },
            },
          ]),
      });
    }
    buttons.push({ text: t("Annuler"), style: "cancel" });
    Alert.alert(t("Commentaire"), undefined, buttons);
  }

  const summary = reactionSummary(reactions, me);

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Fil de {name}", { name: horse?.name ?? t("ton cheval") })}
            </Text>
            {target ? <Text className="text-sm text-muted">{target}</Text> : null}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Fermer")} onPress={close} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      <View className="flex-row flex-wrap gap-2">
        {summary.map((r) => (
          <TouchableOpacity
            key={r.emoji}
            accessibilityRole="button"
            accessibilityState={{ selected: r.mine }}
            accessibilityLabel={t("{emoji}, {n} réactions", { emoji: r.emoji, n: r.count })}
            onPress={() => void react(r.emoji)}
            className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${r.mine ? "bg-primary/15 border border-primary" : "bg-surface border border-border"}`}
          >
            <Text className="text-base">{r.emoji}</Text>
            {r.count > 0 ? <Text className="text-xs font-semibold text-text">{r.count}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      {comments === null && !failed ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : failed ? (
        <Text className="text-sm text-muted">{t("Le fil n'a pas pu être chargé. Vérifie ta connexion.")}</Text>
      ) : comments!.length === 0 ? (
        <Text className="text-sm text-muted">{t("Pas encore de commentaire. Lance la conversation !")}</Text>
      ) : (
        comments!.map((c) => (
          <TouchableOpacity
            key={c.id}
            accessibilityRole="button"
            accessibilityHint={t("Appui long pour supprimer ou signaler")}
            onLongPress={() => openActions(c)}
            delayLongPress={350}
            activeOpacity={0.9}
            className={`${CARD} gap-1 ${c.authorUserId === me ? "ml-8" : "mr-8"}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-primary">{authorLabel(c, me)}</Text>
              <Text className="text-xs text-muted">{relativeTime(c.createdAt)}</Text>
            </View>
            <Text className="text-[15px] leading-5 text-text">{c.body}</Text>
          </TouchableOpacity>
        ))
      )}

      <View className={`${CARD} gap-2`}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t("Écris un commentaire…")}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={COMMENT_MAX}
          className="min-h-[44px] text-base text-text"
          accessibilityLabel={t("Ton commentaire")}
        />
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] text-muted">{t("Visible par les personnes qui suivent ce cheval.")}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!cleanCommentBody(text) || sending}
            onPress={() => void send()}
            className={`rounded-full px-4 py-2 ${cleanCommentBody(text) ? "bg-primary" : "bg-border"}`}
          >
            <Text className={`text-sm font-bold ${cleanCommentBody(text) ? "text-on-primary" : "text-muted"}`}>
              {sending ? t("Envoi…") : t("Envoyer")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}
