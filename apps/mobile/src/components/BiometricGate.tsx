import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, AppStateStatus, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { authenticateWithBiometrics, isBiometricLockEnabled } from "@/lib/biometrics";
import { colors } from "@/theme/colors";

type GateStatus = "checking" | "locked" | "unlocked";

/**
 * Verrou biométrique réel à l'ouverture/réouverture de l'app — jusqu'ici le
 * réglage "Verrouillage Face ID" (cf. profile.tsx) ne redemandait Face ID
 * qu'au moment précis où le mot de passe est tapé sur l'écran de login
 * (cf. (auth)/login.tsx), jamais en reprenant l'app depuis l'arrière-plan ou
 * en la relançant alors qu'une session persistée existe déjà (cf.
 * supabase.ts persistSession) : n'importe qui avec le téléphone déverrouillé
 * accédait directement aux données sans aucun prompt, malgré le réglage
 * activé. Couvre cold start (session déjà active) ET reprise depuis le
 * vrai arrière-plan ("background", pas "inactive" qui survient aussi pour
 * un simple pull du centre de contrôle sans quitter l'app — on ne reverrouille
 * pas dans ce cas pour éviter un flicker à chaque pull-down). View absolue
 * plutôt que <Modal> : même contournement que BadgeCelebration (Expo Go +
 * New Architecture). Monté une seule fois à la racine, au-dessus du Stack.
 */
export function BiometricGate() {
  const [status, setStatus] = useState<GateStatus>("checking");
  const unlocking = useRef(false);
  // true entre le moment où on passe en "checking" (vrai passage en
  // arrière-plan) et la réévaluation au retour — piloté explicitement plutôt
  // que comparé à AppState "prev" : iOS émet toujours un état "inactive"
  // intermédiaire entre "background" et "active" au retour, qui écrasait
  // "prev" avant que la comparaison `prev === "background"` ne s'exécute et
  // empêchait donc TOUJOURS la réévaluation au retour — l'app restait bloquée
  // indéfiniment sur le spinner "checking" après le tout premier passage en
  // arrière-plan, pour tous les utilisateurs (cf. audit du 2026-09-08).
  const pendingReEval = useRef(false);

  async function evaluate() {
    try {
      const [lockEnabled, { data }] = await Promise.all([isBiometricLockEnabled(), supabase.auth.getSession()]);
      setStatus(lockEnabled && data.session ? "locked" : "unlocked");
    } catch (e) {
      console.warn("[biometric-gate] évaluation échouée, déverrouillé par défaut", e);
      setStatus("unlocked");
    }
  }

  useEffect(() => {
    evaluate();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background") {
        setStatus((s) => {
          if (s !== "unlocked") return s;
          pendingReEval.current = true;
          return "checking";
        });
      } else if (next === "active" && pendingReEval.current) {
        pendingReEval.current = false;
        evaluate();
      }
    });

    return () => sub.remove();
  }, []);

  async function tryUnlock() {
    if (unlocking.current) return;
    unlocking.current = true;
    try {
      const ok = await authenticateWithBiometrics("Confirme ton identité pour accéder à Horsetrack");
      if (ok) setStatus("unlocked");
    } catch (e) {
      console.warn("[biometric-gate] authentification échouée", e);
    } finally {
      unlocking.current = false;
    }
  }

  useEffect(() => {
    if (status === "locked") tryUnlock();
  }, [status]);

  if (status === "unlocked") return null;

  if (status === "checking") {
    return (
      <View className="absolute inset-0 z-50 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="absolute inset-0 z-50 items-center justify-center gap-4 bg-background px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
        <MaterialCommunityIcons name="shield-lock-outline" size={30} color={colors.primary} />
      </View>
      <Text className="text-center text-lg font-bold text-text">Authentification requise</Text>
      <Text className="text-center text-sm text-muted">Confirme ton identité pour accéder à Horsetrack.</Text>
      <TouchableOpacity
        onPress={tryUnlock}
        activeOpacity={0.85}
        className="rounded-card bg-primary px-6 py-3"
      >
        <Text className="text-base font-bold text-on-primary">Déverrouiller</Text>
      </TouchableOpacity>
    </View>
  );
}
