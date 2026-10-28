import { useState } from "react";
import { Alert, Linking, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { ChipSelect } from "@/components/FormChips";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { deleteContact, saveContact, useContacts } from "@/extras/store";
import { telUrl, type Contact, type ContactRole } from "@/extras/model";
import { CONTACT_ROLES, roleMeta } from "@/extras/contactRoles";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

type Draft = { id?: string; name: string; role: ContactRole; phone: string; email: string; notes: string };
const EMPTY: Draft = { name: "", role: "veto", phone: "", email: "", notes: "" };

/**
 * Carnet de contacts : véto, maréchal, ostéo, coach… Un toucher pour appeler.
 * Les rendez-vous retrouvent le bon contact (cf. extras/model.ts
 * contactForAppointment) et proposent l'appel directement.
 */
export default function ContactsScreen() {
  const colors = useThemeColors();
  const contacts = useContacts();
  const [draft, setDraft] = useState<Draft | null>(null);

  const sorted = [...contacts].sort(
    (a, b) =>
      CONTACT_ROLES.findIndex((r) => r.value === a.role) - CONTACT_ROLES.findIndex((r) => r.value === b.role) ||
      a.name.localeCompare(b.name)
  );

  function handleSave() {
    if (!draft || !draft.name.trim()) return;
    saveContact({
      id: draft.id,
      name: draft.name.trim(),
      role: draft.role,
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      notes: draft.notes.trim(),
    });
    setDraft(null);
  }

  function confirmDelete(contact: Contact) {
    Alert.alert(t("Supprimer {name} ?", { name: contact.name }), undefined, [
      { text: t("Annuler"), style: "cancel" },
      {
        text: t("Supprimer"),
        style: "destructive",
        onPress: () => {
          deleteContact(contact.id);
          setDraft(null);
        },
      },
    ]);
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-0.5">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Mes contacts")}
            </Text>
            <Text className="text-sm text-muted">{t("Véto, maréchal, ostéo, coach : un toucher pour appeler.")}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      {draft ? (
        <FadeInView>
          <View className={`${CARD} gap-4`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">
              {draft.id ? t("Modifier le contact") : t("Nouveau contact")}
            </Text>
            <Field label={t("Métier")}>
              <ChipSelect
                options={CONTACT_ROLES.map((r) => ({ value: r.value, label: r.label, icon: r.icon }))}
                value={draft.role}
                onChange={(role) => setDraft({ ...draft, role })}
              />
            </Field>
            <Field label={t("Nom")}>
              <TextInput
                className={INPUT}
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                placeholder={t("Ex : Dr Martin")}
                placeholderTextColor={colors.textMuted}
                maxLength={80}
              />
            </Field>
            <Field label={t("Téléphone")}>
              <TextInput
                className={INPUT}
                value={draft.phone}
                onChangeText={(phone) => setDraft({ ...draft, phone })}
                placeholder="06 12 34 56 78"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={30}
              />
            </Field>
            <Field label={t("Email (optionnel)")}>
              <TextInput
                className={INPUT}
                value={draft.email}
                onChangeText={(email) => setDraft({ ...draft, email })}
                placeholder={t("Email")}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
              />
            </Field>
            <Field label={t("Notes (optionnel)")}>
              <TextInput
                className={INPUT}
                value={draft.notes}
                onChangeText={(notes) => setDraft({ ...draft, notes })}
                placeholder={t("Ex : urgences le week-end, cabinet à Saumur")}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={300}
              />
            </Field>
            <PrimaryButton label={t("Enregistrer")} onPress={handleSave} disabled={!draft.name.trim()} />
            <View className="flex-row justify-center gap-6">
              <TouchableOpacity accessibilityRole="button" onPress={() => setDraft(null)}>
                <Text className="text-sm font-semibold text-muted">{t("Annuler")}</Text>
              </TouchableOpacity>
              {draft.id ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    const c = contacts.find((x) => x.id === draft.id);
                    if (c) confirmDelete(c);
                  }}
                >
                  <Text className="text-sm font-semibold text-danger">{t("Supprimer")}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </FadeInView>
      ) : (
        <FadeInView>
          <TouchableOpacity
            className={`${CARD} flex-row items-center gap-3`}
            accessibilityRole="button"
            onPress={() => setDraft(EMPTY)}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
              <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
            </View>
            <Text className="text-base font-semibold text-primary">{t("Ajouter un contact")}</Text>
          </TouchableOpacity>
        </FadeInView>
      )}

      {sorted.length === 0 && !draft ? (
        <Text className="text-center text-sm text-muted">
          {t("Ajoute ton véto et ton maréchal : tes rendez-vous proposeront de les appeler d'un toucher.")}
        </Text>
      ) : null}

      {sorted.map((c, i) => {
        const meta = roleMeta(c.role);
        const tel = telUrl(c.phone);
        return (
          <FadeInView key={c.id} delay={Math.min(i, 8) * 30}>
            <View className={`${CARD} gap-3`}>
              <TouchableOpacity
                className="flex-row items-center gap-3"
                accessibilityRole="button"
                accessibilityLabel={t("{name}, {role}. Modifier", { name: c.name, role: meta.label })}
                onPress={() => setDraft({ id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email, notes: c.notes })}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                  <MaterialCommunityIcons name={meta.icon} size={20} color={colors.primary} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-text">{c.name}</Text>
                  <Text className="text-xs text-muted">
                    {meta.label}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
              {tel || c.email ? (
                <View className="flex-row gap-2">
                  {tel ? (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card bg-primary p-3"
                      accessibilityRole="button"
                      accessibilityLabel={t("Appeler {name}", { name: c.name })}
                      onPress={() => void Linking.openURL(tel)}
                    >
                      <MaterialCommunityIcons name="phone" size={16} color={colors.textOnPrimary} />
                      <Text className="text-sm font-bold text-on-primary">{t("Appeler")}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {c.email ? (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card border border-border p-3"
                      accessibilityRole="button"
                      accessibilityLabel={t("Écrire à {name}", { name: c.name })}
                      onPress={() => void Linking.openURL(`mailto:${encodeURIComponent(c.email)}`)}
                    >
                      <MaterialCommunityIcons name="email-outline" size={16} color={colors.text} />
                      <Text className="text-sm font-semibold text-text">{t("Email")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          </FadeInView>
        );
      })}
    </Screen>
  );
}
