import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { Skeleton } from "@/components/Skeleton";
import { PrimaryButton } from "@/components/onboarding";
import { AddToggle, ChipSelect } from "@/components/FormChips";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useHorseTeams, invalidateHorseTeam } from "@/horses/team";
import { useContacts } from "@/extras/store";
import { useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { can, roleOf } from "@/lib/permissions";
import {
  COLLABORATOR_ROLES,
  ROLE_LABEL,
  ROLE_RIGHTS,
  changeCollaboratorRole,
  inviteCollaborator,
  listTeamShares,
  revokeCollaborator,
  type CollaboratorRole,
} from "@/lib/sharing";
import { groupTeam, invitableHorses, summarizeInvites, type InviteOutcome, type ShareRow, type TeamPerson } from "@/team/teamModel";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Équipe de l'écurie (Écurie Pro v2) : toutes les personnes qui suivent les
 * chevaux, leur rôle sur chacun ; inviter une fois pour plusieurs chevaux,
 * changer un rôle, retirer, écrire ou appeler. Pour le propriétaire et le
 * gérant (les droits sont vérifiés par la base, cf. rls.sql).
 */
export default function TeamScreen() {
  const colors = useThemeColors();
  const { horses } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const contacts = useContacts();
  // Chevaux dont on gère l'équipe : les siens, et ceux dont on est gérant.
  const managed = useMemo(() => horses.filter((h) => can(roleOf(h.sharedRole), "manage_sharing")), [horses]);
  const managedIds = useMemo(() => managed.map((h) => h.id), [managed]);
  const teams = useHorseTeams(managedIds);
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("DEMI_PENSION");
  const [targets, setTargets] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listTeamShares(managedIds)
      .then((list) => {
        setLoadError(!list);
        if (list) setRows(list);
      })
      .catch(() => setLoadError(true));
  }, [managedIds]);

  useEffect(() => {
    refresh();
    track("team_viewed", {});
  }, [refresh]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of Object.values(teams)) for (const m of team) map.set(m.userId, m.name);
    return map;
  }, [teams]);
  const people = useMemo(() => (rows ? groupTeam(rows, managed, names) : []), [rows, managed, names]);
  const existing = people.find((p) => p.email === email.trim().toLowerCase()) ?? null;
  const choices = invitableHorses(managed, existing);
  // Seul le propriétaire nomme un gérant : proposé si tous les chevaux visés sont à soi.
  const ownsTargets = targets.length > 0 && targets.every((id) => !horses.find((h) => h.id === id)?.sharedRole);
  const roles = COLLABORATOR_ROLES.filter((r) => r !== "MANAGER" || ownsTargets);

  async function handleInvite() {
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address) || targets.length === 0 || sending) return;
    setSending(true);
    const results: { horseName: string; result: InviteOutcome }[] = [];
    for (const horseId of targets) {
      const result = await inviteCollaborator(horseId, address, role).catch(() => "error" as const);
      results.push({ horseName: horses.find((h) => h.id === horseId)?.name ?? "", result });
      invalidateHorseTeam(horseId);
    }
    setSending(false);
    const { sent, full, failed } = summarizeInvites(results);
    track("team_invite_sent", { horses: targets.length, sent: sent.length, role });
    if (sent.length > 0) hapticSuccess();
    else hapticError();
    const parts = [
      sent.length ? t("Invitation envoyée pour {horses}.", { horses: sent.join(", ") }) : "",
      full.length ? t("Plus de place sur {horses} (5 personnes au plus avec Écurie Pro, 1 avec Premium).", { horses: full.join(", ") }) : "",
      failed.length ? t("Échec pour {horses} : réessaie dans un instant.", { horses: failed.join(", ") }) : "",
    ].filter(Boolean);
    setNotice(parts.join(" "));
    if (sent.length > 0) {
      animateNextLayout();
      setEmail("");
      setTargets([]);
      setShowInvite(false);
    }
    refresh();
  }

  function editShare(person: TeamPerson, share: TeamPerson["shares"][number]) {
    const ownsHorse = !horses.find((h) => h.id === share.horseId)?.sharedRole;
    const canTouch = ownsHorse || share.role !== "MANAGER";
    if (!canTouch) {
      Alert.alert(t("Réservé au propriétaire"), t("Seul le propriétaire du cheval modifie ou retire un gérant."));
      return;
    }
    const label = person.name ?? person.email;
    Alert.alert(
      t("{name} sur {horse}", { name: label, horse: share.horseName }),
      ROLE_RIGHTS[share.role],
      [
        ...COLLABORATOR_ROLES.filter((r) => r !== share.role && (r !== "MANAGER" || ownsHorse)).map((r) => ({
          text: t("Passer en {role}", { role: ROLE_LABEL[r] }),
          onPress: () => {
            changeCollaboratorRole(share.id, share.horseId, r).then((ok) => {
              if (ok) {
                hapticSuccess();
                track("team_role_changed", { role: r });
                refresh();
              } else {
                hapticError();
                setNotice(t("Le rôle n'a pas pu être changé. Réessaie dans un instant."));
              }
            });
          },
        })),
        {
          text: t("Retirer l'accès à {horse}", { horse: share.horseName }),
          style: "destructive" as const,
          onPress: () => confirmRevoke(label, share),
        },
        { text: t("Annuler"), style: "cancel" as const },
      ]
    );
  }

  function confirmRevoke(label: string, share: TeamPerson["shares"][number]) {
    Alert.alert(t("Retirer {name} ?", { name: label }), t("{name} n'aura plus accès à {horse}. Ses séances passées restent.", { name: label, horse: share.horseName }), [
      { text: t("Annuler"), style: "cancel" },
      {
        text: t("Retirer"),
        style: "destructive",
        onPress: () => {
          revokeCollaborator(share.horseId, { id: share.id, invitedEmail: share.invitedEmail, role: share.role, status: share.status }).then((ok) => {
            invalidateHorseTeam(share.horseId);
            if (ok) {
              hapticSuccess();
              track("team_member_revoked", {});
            } else hapticError();
            refresh();
          });
        },
      },
    ]);
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="font-display text-2xl tracking-tight text-text" accessibilityRole="header">
              {t("Équipe")}
            </Text>
            <Text className="text-sm text-muted">
              {people.length === 0 ? t("Les personnes qui suivent tes chevaux") : t("{count} personne(s) autour de tes chevaux", { count: people.length })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      {notice ? (
        <View className="flex-row items-start gap-2 rounded-card bg-highlight p-4" accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
          <Text className="flex-1 text-sm text-text">{notice}</Text>
        </View>
      ) : null}

      {!isActiveOrTrialing && managed.every((h) => !h.sharedRole) ? (
        <View className={`${CARD} gap-3`}>
          <Text className="text-base font-semibold text-text">{t("Partage tes chevaux avec ton équipe")}</Text>
          <Text className="text-sm text-muted">
            {t("Demi-pension, coach, groom, gérant, vétérinaire : chacun avec les droits de son rôle. Avec Premium (1 personne par cheval) ou Écurie Pro (5).")}
          </Text>
          <PrimaryButton label={t("Découvrir les formules")} onPress={() => openPaywall("sharing", { feature: "team" })} />
        </View>
      ) : (
        <FadeInView delay={40}>
          {showInvite ? (
            <View className={`${CARD} gap-4`}>
              <Text className="text-sm font-bold uppercase tracking-wide text-accent">{t("Inviter quelqu'un")}</Text>
              <Field label={t("Son adresse email")}>
                <TextInput
                  className={INPUT}
                  placeholder="email@exemple.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  accessibilityLabel={t("Son adresse email")}
                />
              </Field>
              <Field label={t("Pour quels chevaux ?")}>
                {choices.length === 0 ? (
                  <Text className="text-sm text-muted">{t("Cette personne a déjà accès à tous tes chevaux.")}</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {choices.map((h) => {
                      const selected = targets.includes(h.id);
                      return (
                        <TouchableOpacity
                          key={h.id}
                          onPress={() => {
                            hapticSelection();
                            setTargets((list) => (selected ? list.filter((x) => x !== h.id) : [...list, h.id]));
                          }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          className={`flex-row items-center gap-2 rounded-full border px-4 py-2 ${
                            selected ? "border-primary bg-highlight" : "border-border bg-surface"
                          }`}
                        >
                          <MaterialCommunityIcons name={selected ? "check" : "horse-variant"} size={15} color={selected ? colors.primary : colors.textMuted} />
                          <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{h.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </Field>
              <Field label={t("Rôle")}>
                <ChipSelect
                  options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r], icon: "account-outline" }))}
                  value={role}
                  onChange={(r) => {
                    hapticSelection();
                    setRole(r);
                  }}
                />
                <Text className="text-sm text-muted">{ROLE_RIGHTS[role]}</Text>
              </Field>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    animateNextLayout();
                    setShowInvite(false);
                  }}
                  accessibilityRole="button"
                  className="flex-1 items-center rounded-card border border-border p-4"
                >
                  <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
                </TouchableOpacity>
                <View className="flex-1">
                  <PrimaryButton
                    label={sending ? t("Un instant…") : t("Inviter")}
                    disabled={sending || !EMAIL.test(email.trim()) || targets.length === 0 || !roles.includes(role)}
                    onPress={handleInvite}
                  />
                </View>
              </View>
            </View>
          ) : managed.length > 0 ? (
            <AddToggle label={t("Inviter quelqu'un")} onPress={() => setShowInvite(true)} color={colors.primary} />
          ) : null}
        </FadeInView>
      )}

      <FadeInView delay={60}>
        <View className="gap-3">
          {rows === null && !loadError ? (
            [0, 1].map((i) => (
              <View key={i} className={`${CARD} gap-3`}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="80%" />
              </View>
            ))
          ) : loadError && rows === null ? (
            <View className={`${CARD} items-center gap-2`}>
              <Text className="text-center text-sm text-muted">{t("L'équipe n'a pas pu être chargée. Vérifie ta connexion.")}</Text>
              <TouchableOpacity onPress={refresh} accessibilityRole="button">
                <Text className="text-sm font-semibold text-accent">{t("Réessayer")}</Text>
              </TouchableOpacity>
            </View>
          ) : people.length === 0 ? (
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-center text-sm text-muted">
                {t("Personne pour l'instant. Invite ta demi-pension, ton coach ou ton groom : ils retrouvent le planning et les soins.")}
              </Text>
            </View>
          ) : (
            people.map((person) => {
              const contact = contacts.find((c) => c.email.trim().toLowerCase() === person.email);
              const phone = contact?.phone.replace(/[^\d+]/g, "");
              return (
                <View key={person.email} className={`${CARD} gap-3`}>
                  <View className="flex-row items-center gap-3">
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-highlight">
                      <Text className="text-base font-bold text-primary">{(person.name ?? person.email).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-bold text-text" numberOfLines={1}>
                        {person.name ?? person.email}
                      </Text>
                      {person.name ? (
                        <Text className="text-sm text-muted" numberOfLines={1}>
                          {person.email}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`mailto:${person.email}`)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("Écrire à {name}", { name: person.name ?? person.email })}
                    >
                      <MaterialCommunityIcons name="email-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    {phone ? (
                      <TouchableOpacity
                        onPress={() => void Linking.openURL(`tel:${phone}`)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("Appeler {name}", { name: person.name ?? person.email })}
                      >
                        <MaterialCommunityIcons name="phone-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {person.shares.map((share) => (
                    <TouchableOpacity
                      key={share.id}
                      onPress={() => editShare(person, share)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t("{horse}, {role}, modifier", { horse: share.horseName, role: ROLE_LABEL[share.role] })}
                      className="flex-row items-center justify-between rounded-card bg-background px-4 py-3"
                    >
                      <Text className="text-sm font-semibold text-text">{share.horseName}</Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm text-muted">
                          {ROLE_LABEL[share.role]}
                          {share.status === "PENDING" ? ` · ${t("en attente")}` : ""}
                        </Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </View>
      </FadeInView>
    </Screen>
  );
}
