import { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { getLocalDataOwner, setLocalDataOwner } from "@/lib/deviceOwner";
import { signInWithApple, useAppleSignInAvailable } from "@/lib/appleAuth";
import { useSessions } from "@/sessions/store";
import { useAgenda } from "@/agenda/store";
import { useGoals } from "@/goals/store";
import { useWeight } from "@/horses/weightStore";
import { useSubscription } from "@/subscription/store";
import { isEmailAlreadyRegisteredError, isEmailNotConfirmedError } from "@/lib/authErrors";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const RESEND_COOLDOWN_SECONDS = 30;

export default function OnboardingAccount() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Écran "Vérifie ton e-mail" affiché à la place du formulaire tant que la
  // confirmation par email (si activée côté projet Supabase) n'a pas encore
  // eu lieu — cf. audit du 2026-09-06 : l'ancien code affichait une Alert
  // fugitive puis naviguait quand même vers le paywall sans session valide,
  // ce qui poussait l'utilisateur dans l'onboarding/paywall sans qu'aucune
  // synchro cloud ne puisse jamais aboutir (aucune session tant que l'email
  // n'est pas confirmé). Si la confirmation n'est pas requise pour ce projet
  // (data.session déjà présent après signUp), cet écran n'est jamais montré.
  const [step, setStep] = useState<"form" | "confirmEmail">("form");
  const [checkingConfirmation, setCheckingConfirmation] = useState(false);
  const [notConfirmedYet, setNotConfirmedYet] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendResult, setResendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const appleAvailable = useAppleSignInAvailable();
  // Horses/rider sont déjà écrasés par les réponses d'onboarding à l'étape
  // paywall (cf. (onboarding)/paywall.tsx) — seuls ces trois-là ne le sont
  // jamais et resteraient ceux d'un compte précédent sur cet appareil.
  const { clearAll: clearSessions } = useSessions();
  const { clearAll: clearAgenda } = useAgenda();
  const { clearAll: clearGoals } = useGoals();
  const { clearAll: clearWeight } = useWeight();
  const { clearAll: clearSubscription } = useSubscription();

  // Si une session existe déjà (ex: Sign in with Apple utilisé depuis
  // l'écran login, ou reprise d'une création interrompue — cf. le même
  // contrôle dans createAccount), les champs email/mot de passe restent
  // vides et le bouton "Créer mon compte" resterait désactivé sans porte
  // de sortie : on saute directement au paywall dès que l'écran s'affiche.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/(onboarding)/paywall");
    });
  }, []);

  // Décompte du cooldown "Renvoyer l'e-mail" — un intervalle d'une seconde
  // tant qu'il reste du temps, jamais lancé sinon.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function afterAccountObtained(userId: string) {
    const owner = await getLocalDataOwner();
    if (owner && owner !== userId) {
      await Promise.all([clearSessions(), clearAgenda(), clearGoals(), clearWeight(), clearSubscription()]);
    }
    await setLocalDataOwner(userId);
  }

  async function handleAppleSignIn() {
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result.cancelled) {
        return;
      }
      await afterAccountObtained(result.userId);
      router.push("/(onboarding)/paywall");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Connexion avec Apple impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      // Si une tentative précédente a déjà créé ce compte (signUp réussi) mais
      // que l'app a été interrompue avant la fin du paywall (cf. (onboarding)/
      // paywall.tsx — seul endroit qui appelle markOnboardingCompleted()), on a
      // déjà une session ici : app/index.tsx renvoie vers l'onboarding tant que
      // ce flag n'est pas posé, donc on repasse forcément par cet écran. Re-
      // appeler signUp() échouerait alors avec "email déjà utilisé" sans porte
      // de sortie. On poursuit directement plutôt que de re-créer un compte.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        router.push("/(onboarding)/paywall");
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });

      if (error) {
        const message = isEmailAlreadyRegisteredError(error.message)
          ? "Un compte existe déjà avec cet email — connecte-toi plutôt."
          : error.message;
        Alert.alert("Erreur", message);
        return;
      }

      const userId = data.user?.id;
      if (userId) await afterAccountObtained(userId);

      if (data.session) {
        // Confirmation email désactivée pour ce projet (ou déjà satisfaite) :
        // une session existe immédiatement, on poursuit le flux normal sans
        // jamais montrer l'écran "Vérifie ton e-mail".
        router.push("/(onboarding)/paywall");
      } else {
        // Confirmation requise : pas de session tant que le lien n'est pas
        // cliqué — naviguer vers le paywall maintenant pousserait l'onboarding
        // sans session valide (aucune synchro cloud possible). On affiche
        // plutôt un écran dédié avec une vraie action de vérification.
        setNotConfirmedYet(false);
        setResendResult(null);
        setStep("confirmEmail");
      }
    } catch (e) {
      // Toute exception (réseau, erreur Supabase inattendue non renvoyée
      // comme `{ error }`) atterrissait ici sans jamais réinitialiser
      // `loading` — cause du bouton "Création..." bloqué indéfiniment.
      Alert.alert(
        "Erreur",
        e instanceof Error ? e.message : "Impossible de créer le compte pour l'instant. Vérifie ta connexion et réessaie."
      );
    } finally {
      setLoading(false);
    }
  }

  /** "J'ai vérifié mon e-mail" — confirmer l'email ne crée pas de session
   * locale toute seule (le lien de confirmation ne redirige pas dans l'app) :
   * la seule façon fiable de savoir si c'est bon est de retenter une vraie
   * connexion avec les identifiants déjà saisis. Supabase refuse la connexion
   * tant que l'email n'est pas confirmé (erreur explicite), ce qui donne
   * directement la réponse sans jamais rester en attente indéfiniment. */
  async function checkEmailConfirmed() {
    setCheckingConfirmation(true);
    setNotConfirmedYet(false);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (data.session) {
        router.push("/(onboarding)/paywall");
        return;
      }
      if (error && isEmailNotConfirmedError(error.message)) {
        setNotConfirmedYet(true);
      } else if (error) {
        Alert.alert("Erreur", error.message);
      }
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de vérifier pour l'instant. Vérifie ta connexion et réessaie.");
    } finally {
      setCheckingConfirmation(false);
    }
  }

  async function resendConfirmationEmail() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendResult(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) {
        setResendResult({ ok: false, message: error.message });
      } else {
        setResendResult({ ok: true, message: "Un nouvel e-mail de confirmation a été envoyé." });
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch (e) {
      setResendResult({
        ok: false,
        message: e instanceof Error ? e.message : "Impossible d'envoyer l'e-mail pour l'instant.",
      });
    } finally {
      setResending(false);
    }
  }

  function editEmail() {
    // Retour au formulaire sur cette même instance d'écran : email/mot de
    // passe restent tels quels en mémoire (rien n'a jamais été retransmis),
    // aucun nouveau signUp tant que l'utilisateur ne soumet pas à nouveau —
    // donc aucun risque de créer un deuxième compte par inadvertance.
    setStep("form");
    setNotConfirmedYet(false);
    setResendResult(null);
    setResendCooldown(0);
  }

  if (step === "confirmEmail") {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-1 gap-5 px-5 pt-8">
          <View className="gap-2">
            <Text className="text-2xl font-display tracking-tight text-text">Vérifie ton adresse e-mail</Text>
            <Text className="text-base text-muted">
              Un e-mail de confirmation vient de t&apos;être envoyé à{" "}
              <Text className="font-semibold text-text">{email.trim()}</Text>.
            </Text>
            <Text className="text-base text-muted">
              Vérifie ta boîte de réception (et tes spams) et clique sur le lien pour activer ton compte.
            </Text>
          </View>

          {notConfirmedYet ? (
            <View className="rounded-card border border-warning bg-highlight/40 p-4">
              <Text className="text-sm font-semibold text-text">Ton adresse e-mail n&apos;est pas encore vérifiée.</Text>
              <Text className="mt-1 text-sm text-muted">
                Clique sur le lien reçu par e-mail, puis réessaie.
              </Text>
            </View>
          ) : null}

          {resendResult ? (
            <Text className={`text-sm font-semibold ${resendResult.ok ? "text-success" : "text-danger"}`}>
              {resendResult.message}
            </Text>
          ) : null}
        </View>

        <View className="gap-3 px-5 pb-2 pt-3">
          <PrimaryButton
            label={checkingConfirmation ? "Vérification..." : "J'ai vérifié mon e-mail"}
            disabled={checkingConfirmation}
            onPress={checkEmailConfirmed}
          />
          <TouchableOpacity onPress={resendConfirmationEmail} disabled={resending || resendCooldown > 0} hitSlop={8}>
            <Text className={`text-center text-sm font-semibold ${resending || resendCooldown > 0 ? "text-muted" : "text-accent"}`}>
              {resending
                ? "Envoi..."
                : resendCooldown > 0
                  ? `Renvoyer l'e-mail (${resendCooldown}s)`
                  : "Renvoyer l'e-mail"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={editEmail} hitSlop={8}>
            <Text className="text-center text-sm font-semibold text-accent">Modifier mon adresse e-mail</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
            <Text className="text-center text-sm font-semibold text-muted">Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <View className="gap-2">
          <Text className="text-2xl font-display tracking-tight text-text">
            Crée ton compte pour sauvegarder ton écurie
          </Text>
          <Text className="text-base text-muted">
            Tes réponses et tes chevaux seront liés à ce compte.
          </Text>
        </View>

        <Field label="Email">
          <TextInput
            className={INPUT}
            placeholder="toi@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </Field>

        <Field label="Mot de passe">
          <TextInput
            className={INPUT}
            placeholder="6 caractères minimum"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Field>

        <Field label="Confirmer le mot de passe">
          <TextInput
            className={INPUT}
            placeholder="Retape ton mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          {passwordsMismatch ? (
            <Text className="text-xs text-red-500">Les mots de passe ne correspondent pas.</Text>
          ) : null}
        </Field>
      </View>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={loading ? "Création..." : "Créer mon compte"}
          disabled={loading || !email.trim() || password.length < 6 || password !== confirmPassword}
          onPress={createAccount}
        />
        {appleAvailable ? (
          <>
            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-xs text-muted">ou</Text>
              <View className="h-px flex-1 bg-border" />
            </View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ height: 48, width: "100%" }}
              onPress={handleAppleSignIn}
            />
          </>
        ) : null}
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text className="text-center text-sm font-semibold text-accent">
            Déjà un compte ? Se connecter
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
