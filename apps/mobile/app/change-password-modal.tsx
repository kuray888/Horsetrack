import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

const INPUT = "rounded-card border border-border bg-surface p-4 pr-11 text-base text-text";

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisible,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <Field label={label}>
      <View className="relative justify-center">
        <TextInput
          className={INPUT}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoComplete={autoComplete}
          textContentType={autoComplete === "current-password" ? "password" : "newPassword"}
        />
        <TouchableOpacity
          onPress={onToggleVisible}
          hitSlop={12}
          className="absolute right-3"
          accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </Field>
  );
}

/** Erreur Supabase distincte de "mauvais mot de passe" / "session expirée" —
 * détection tolérante par mot-clé, comme lib/authErrors.ts : GoTrue ne garantit
 * pas de code d'erreur stable dans toutes les versions pour ces cas. */
function isInvalidCredentialsError(message: string): boolean {
  return /invalid login credentials/i.test(message);
}

function isSessionMissingError(message: string): boolean {
  return /session|jwt|not authenticated|not logged in/i.test(message);
}

function isWeakPasswordError(message: string): boolean {
  return /weak|short|at least|should be/i.test(message);
}

/**
 * Profil → Sécurité → Modifier le mot de passe. Deux cas distincts (cf.
 * user.identities Supabase) :
 * - compte avec identité "email" (mot de passe existant) : exige l'ancien mot
 *   de passe, vérifié réellement côté serveur via une ré-authentification
 *   (signInWithPassword) — Supabase n'expose pas de simple "vérifie ce mot de
 *   passe" isolé de toute connexion, donc on retente une vraie connexion :
 *   si elle échoue, l'ancien mot de passe est incorrect.
 * - compte Apple uniquement (aucune identité "email") : pas d'ancien mot de
 *   passe à vérifier, ce champ est masqué — l'utilisateur peut quand même
 *   définir un mot de passe pour la première fois (ajout d'une méthode de
 *   connexion, pas un remplacement).
 */
export default function ChangePasswordModal() {
  const [checkingIdentity, setCheckingIdentity] = useState(true);
  // Par sécurité si la vérification échoue (réseau), on suppose qu'un mot de
  // passe existe déjà — demander l'ancien par excès de prudence est sans
  // risque, l'inverse (l'omettre alors qu'il existe) contournerait la
  // vérification.
  const [hasPassword, setHasPassword] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const identities = data.user?.identities ?? [];
        setHasPassword(identities.some((i) => i.provider === "email"));
        setEmail(data.user?.email ?? null);
      })
      .catch((e) => console.warn("[change-password] getUser échoué", e))
      .finally(() => setCheckingIdentity(false));
  }, []);

  const passwordTooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave =
    !checkingIdentity &&
    !loading &&
    (!hasPassword || currentPassword.length > 0) &&
    password.length >= 6 &&
    password === confirm;

  async function submit() {
    // Garde-fou double-tap en plus du `disabled` du bouton (cf. son commentaire) —
    // un deuxième appui juste avant le re-rendu ne doit pas déclencher un
    // deuxième submit concurrent (deux ré-authentifications qui se
    // chevauchent, par ex.).
    if (!canSave || loading) return;
    setLoading(true);
    try {
      if (hasPassword) {
        if (!email) {
          Alert.alert("Erreur", "Impossible de vérifier ton compte pour l'instant. Reconnecte-toi et réessaie.");
          return;
        }
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (reauthError) {
          if (isInvalidCredentialsError(reauthError.message)) {
            Alert.alert("Erreur", "Le mot de passe actuel est incorrect.");
          } else if (isSessionMissingError(reauthError.message)) {
            Alert.alert("Session expirée", "Reconnecte-toi pour changer ton mot de passe.");
            router.replace("/(auth)/login");
          } else {
            Alert.alert("Erreur", reauthError.message);
          }
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (isSessionMissingError(error.message)) {
          Alert.alert("Session expirée", "Reconnecte-toi pour changer ton mot de passe.");
          router.replace("/(auth)/login");
        } else if (isWeakPasswordError(error.message)) {
          Alert.alert("Mot de passe trop faible", "Choisis un mot de passe plus long ou plus complexe.");
        } else {
          Alert.alert("Erreur", error.message);
        }
        return;
      }

      Alert.alert("Mot de passe modifié", "Ton mot de passe a bien été mis à jour.");
      router.back();
    } catch (e) {
      Alert.alert(
        "Erreur",
        e instanceof Error
          ? e.message
          : "Impossible de mettre à jour le mot de passe pour l'instant. Vérifie ta connexion et réessaie."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-display tracking-tight text-text">Changer le mot de passe</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>

      {checkingIdentity ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View className="gap-5 px-5 pt-6">
            {hasPassword ? (
              <PasswordField
                label="Mot de passe actuel"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Ton mot de passe actuel"
                visible={showCurrent}
                onToggleVisible={() => setShowCurrent((v) => !v)}
                autoComplete="current-password"
              />
            ) : (
              <Text className="text-sm text-muted">
                Ton compte est connecté avec Apple — définis ci-dessous un mot de passe pour pouvoir aussi te
                connecter avec ton email.
              </Text>
            )}

            <PasswordField
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="6 caractères minimum"
              visible={showNew}
              onToggleVisible={() => setShowNew((v) => !v)}
              autoComplete="new-password"
            />
            {passwordTooShort ? (
              <Text className="-mt-3 text-xs text-danger">Au moins 6 caractères.</Text>
            ) : null}

            <PasswordField
              label="Confirmer le mot de passe"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Retape ton nouveau mot de passe"
              visible={showConfirm}
              onToggleVisible={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
            />
            {mismatch ? (
              <Text className="-mt-3 text-xs text-danger">Les mots de passe ne correspondent pas.</Text>
            ) : null}

            {hasPassword ? (
              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                disabled={loading}
                hitSlop={8}
                className="self-start"
              >
                <Text className="text-sm font-semibold text-accent">Mot de passe oublié ?</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="px-5 pb-2 pt-6">
            <PrimaryButton
              label={loading ? "Enregistrement..." : "Enregistrer"}
              disabled={!canSave}
              onPress={submit}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
