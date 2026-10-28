import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { useContacts } from "@/extras/store";
import { telUrl } from "@/extras/model";
import { track } from "@/lib/analytics";
import { animateNextLayout } from "@/lib/motion";
import { buildMonthFacts, buildRecordsFacts } from "@/coach/facts";
import { askCoach, fetchCoachStatus, requestMonthSummary, type CoachStatus, type SummaryStatus } from "@/coach/coachApi";
import { useCoachContext } from "@/coach/useCoachContext";
import { monthName } from "@/lib/progress";
import { LANG, t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

const EXAMPLES = [
  t("C'est quand le prochain vermifuge ?"),
  t("Combien j'ai dépensé en maréchal cette année ?"),
  t("Combien de séances ce mois-ci ?"),
  t("Quand le vétérinaire est-il venu la dernière fois ?"),
];

type Exchange = { question: string; answer: string; found: boolean; medical: boolean };

/** Fermer : retour, ou Accueil si l'écran a été ouvert directement. */
function close() {
  if (router.canGoBack()) router.back();
  else router.dismissTo("/(tabs)/today");
}

/**
 * Ton coach (Premium) : questions sur le carnet du cheval actif — réponses
 * tirées seulement de ses données, « pas dans le carnet » sinon, et renvoi
 * vers le vétérinaire au moindre symptôme — et résumé du mois écoulé.
 */
export default function CoachScreen() {
  const colors = useThemeColors();
  const { selectedHorse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const contacts = useContacts();
  const ctx = useCoachContext(selectedHorse ?? null);
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [summary, setSummary] = useState<{ status: SummaryStatus; text: string | null } | null>(null);

  const vet = contacts.find((c) => c.role === "veto" && telUrl(c.phone));

  // Mois écoulé : celui que le résumé couvre.
  const last = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 0 ? { year: now.getFullYear() - 1, month: 11 } : { year: now.getFullYear(), month: now.getMonth() - 1 };
  }, []);
  const monthKey = `${last.year}-${String(last.month + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (!isActiveOrTrialing) return;
    fetchCoachStatus().then(setStatus);
  }, [isActiveOrTrialing]);

  useEffect(() => {
    if (!isActiveOrTrialing || !ctx || !selectedHorse) return;
    let cancelled = false;
    requestMonthSummary(selectedHorse.id, monthKey, LANG, buildMonthFacts(ctx, last.year, last.month)).then((r) => {
      if (cancelled) return;
      setSummary({ status: r.status, text: r.summary });
      if (r.status === "DONE") track("coach_summary_viewed", { month: monthKey });
    });
    return () => {
      cancelled = true;
    };
    // Une demande par ouverture de l'écran et par cheval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveOrTrialing, selectedHorse?.id, monthKey]);

  async function send(text: string) {
    const q = text.trim();
    if (!ctx || q.length < 2 || asking) return;
    setAsking(true);
    setNotice(null);
    const r = await askCoach(LANG, q, buildRecordsFacts(ctx));
    setAsking(false);
    track("coach_question_asked", { status: r.status, medical: r.status === "ok" && r.medical });
    if (r.status === "ok") {
      animateNextLayout();
      setHistory((h) => [{ question: q, answer: r.answer, found: r.found, medical: r.medical }, ...h]);
      setQuestion("");
      if (r.questionsLeft !== undefined) setStatus((s) => (s ? { ...s, questionsLeft: r.questionsLeft! } : s));
    } else if (r.status === "quota") {
      setNotice(t("Tu as posé tes {n} questions du mois. Le compteur repart le 1er.", { n: status?.questionsLimit ?? 30 }));
    } else if (r.status === "premium") {
      openPaywall("coach", { feature: "coach_question" });
    } else if (r.status === "unavailable") {
      setNotice(t("Le coach fait une pause pour le moment. Réessaie plus tard."));
    } else {
      setNotice(t("Pas de connexion. Réessaie dans un instant."));
    }
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Ton coach")}
            </Text>
            <Text className="text-sm text-muted">
              {selectedHorse
                ? t("Il répond d'après le carnet de {name} : séances, soins, dépenses, poids.", { name: selectedHorse.name })
                : t("Ajoute d'abord un cheval.")}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Fermer")} onPress={close} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      {!isActiveOrTrialing ? (
        <FadeInView delay={40}>
          <View className={`${CARD} gap-3`}>
            <Text className="text-base text-text">
              {t("Pose une question sur ton cheval, et reçois chaque mois un résumé de votre travail. Réservé à Premium.")}
            </Text>
            <PrimaryButton label={t("Découvrir Premium")} onPress={() => openPaywall("coach", { feature: "coach_screen" })} />
          </View>
        </FadeInView>
      ) : (
        <>
          {status && !status.available ? (
            <FadeInView delay={30}>
              <View className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5">
                <MaterialCommunityIcons name="pause-circle-outline" size={18} color={colors.warning} />
                <Text className="flex-1 text-sm text-text">{t("Le coach fait une pause pour le moment. Réessaie plus tard.")}</Text>
              </View>
            </FadeInView>
          ) : null}

          <FadeInView delay={40}>
            <View className={`${CARD} gap-3`}>
              <TextInput
                className={INPUT}
                value={question}
                onChangeText={setQuestion}
                placeholder={t("Pose une question sur ton cheval")}
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                multiline
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => void send(question)}
                accessibilityLabel={t("Ta question")}
              />
              <View className="flex-row flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <TouchableOpacity
                    key={ex}
                    accessibilityRole="button"
                    onPress={() => void send(ex)}
                    disabled={asking}
                    className="rounded-full bg-highlight px-3 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-primary">{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted">
                  {status ? t("{n} questions restantes ce mois-ci", { n: status.questionsLeft }) : " "}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void send(question)}
                  disabled={asking || question.trim().length < 2}
                  className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${question.trim().length < 2 ? "bg-border" : "bg-primary"}`}
                >
                  {asking ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : null}
                  <Text className={`text-sm font-bold ${question.trim().length < 2 ? "text-muted" : "text-on-primary"}`}>{t("Demander")}</Text>
                </TouchableOpacity>
              </View>
              {notice ? <Text className="text-sm text-muted">{notice}</Text> : null}
              <Text className="text-[11px] leading-4 text-muted">
                {t("Le coach ne remplace pas ton vétérinaire et ne donne aucun avis médical.")}
              </Text>
            </View>
          </FadeInView>

          {history.map((h, i) => (
            <FadeInView key={`${h.question}-${history.length - i}`}>
              <View className={`${CARD} gap-2 ${h.medical ? "border border-danger/40" : ""}`}>
                <Text className="text-sm font-semibold text-muted">{h.question}</Text>
                <Text className="text-[15px] leading-5 text-text">{h.answer}</Text>
                {h.medical && vet ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => void Linking.openURL(telUrl(vet.phone)!)}
                    className="flex-row items-center gap-1.5 self-start rounded-full bg-danger px-4 py-2"
                  >
                    <MaterialCommunityIcons name="phone" size={16} color={colors.textOnPrimary} />
                    <Text className="text-sm font-bold text-on-primary">{t("Appeler {name}", { name: vet.name })}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </FadeInView>
          ))}

          <FadeInView delay={80}>
            <View className={`${CARD} gap-2`}>
              <Text className="text-sm font-bold uppercase tracking-wide text-primary">
                {t("Ton mois de {month}", { month: monthName(last.month) })}
              </Text>
              {summary === null ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : summary.status === "DONE" && summary.text ? (
                <Text className="text-[15px] leading-5 text-text">{summary.text}</Text>
              ) : summary.status === "PENDING" || summary.status === "SUBMITTED" ? (
                <Text className="text-sm text-muted">{t("Ton résumé est en préparation. Il sera prêt d'ici quelques heures.")}</Text>
              ) : summary.status === "quota" ? (
                <Text className="text-sm text-muted">{t("Résumés de ce mois déjà demandés pour 3 chevaux.")}</Text>
              ) : summary.status === "unavailable" ? (
                <Text className="text-sm text-muted">{t("Le coach fait une pause pour le moment. Réessaie plus tard.")}</Text>
              ) : (
                <Text className="text-sm text-muted">{t("Résumé indisponible pour le moment.")}</Text>
              )}
            </View>
          </FadeInView>
        </>
      )}
    </Screen>
  );
}
