import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, AppStateStatus, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { supabase } from "@/lib/supabase";
import { unregisterPushToken } from "@/lib/pushRegistration";
import { resolveGateStatus } from "@/components/biometricGateLogic";
import { authenticateWithBiometrics, readBiometricLock, setBiometricLockEnabled } from "@/lib/biometrics";
import { isNativeInteractionActive } from "@/lib/nativeInteraction";
import { colors } from "@/theme/colors";
import { t } from "@/i18n";

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
  // Verrou actif ? Sert à masquer le contenu dans le sélecteur d'applications.
  const lockEnabledRef = useRef(false);
  const [covered, setCovered] = useState(false);

  async function evaluate() {
    // Chaque lecture est isolée : une erreur de l'une ne doit jamais ouvrir
    // l'app quand le verrou est actif (cf. biometricGateLogic.ts).
    // isBiometricLockEnabled() avalait l'erreur et répondait « pas de verrou » :
    // l'app s'ouvrait sans Face ID quand le trousseau était encore fermé.
    const read = await readBiometricLock();
    const lockEnabled: boolean | "unknown" = read === null ? "unknown" : read;
    let session: "present" | "absent" | "unknown" = "unknown";
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session ? "present" : "absent";
    } catch (e) {
      console.warn("[biometric-gate] lecture de la session échouée", e);
    }
    lockEnabledRef.current = lockEnabled !== false;
    const next = resolveGateStatus({ lockEnabled, session });
    setStatus(next);
    if (next === "checking") {
      // Relire au prochain retour au premier plan, ou dans un instant si
      // l'app y est déjà (trousseau qui se rouvre au déverrouillage).
      pendingReEval.current = true;
      if (AppState.currentState === "active") setTimeout(() => void evaluate(), 1500);
    }
  }

  useEffect(() => {
    // evaluate() est async et ne fait setStatus qu'après ses deux awaits :
    // pas un setState synchrone dans l'effet, juste un lancement de vérification.
    evaluate();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      // Le sélecteur d'applications d'iOS photographie l'écran à l'état
      // « inactive » : avec le verrou actif, on le recouvre avant la capture.
      setCovered(next !== "active" && lockEnabledRef.current && !isNativeInteractionActive());
      if (next === "background") {
        // Sur Android, ouvrir le sélecteur de photos, la feuille de partage,
        // une demande de permission ou l'écran de paiement met notre activité
        // en pause — donc fait passer l'app en "background", exactement comme
        // si on l'avait quittée (cf. lib/nativeInteraction.ts). Sans cette
        // garde, le verrou se refermait à chaque ajout de photo et redemandait
        // l'empreinte au retour, alors que l'utilisateur n'a jamais quitté
        // Horsetrack. Sur iPhone, aucun de ces écrans ne déclenche
        // "background" : le comportement y est strictement inchangé.
        if (isNativeInteractionActive()) return;
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
    // Au montage seulement : evaluate ne lit que des refs et des setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock() {
    if (unlocking.current) return;
    unlocking.current = true;
    try {
      const ok = await authenticateWithBiometrics(t("Confirme ton identité pour accéder à Horsetrack"));
      if (ok) setStatus("unlocked");
    } catch (e) {
      console.warn("[biometric-gate] authentification échouée", e);
    } finally {
      unlocking.current = false;
    }
  }

  // Échappatoire si la biométrie devient indisponible (Face ID désactivé
  // dans les réglages système, capteur en panne, appareil restauré...) :
  // sans ça, "Déverrouiller" retente indéfiniment le même échec et rien
  // d'autre sur cet écran n'atteint Profil pour désactiver le réglage — un
  // blocage permanent (cf. audit pré-publication). Se déconnecter est sûr
  // ici : sans session, il n'y a plus rien à protéger par ce verrou local.
  function offerFallback() {
    Alert.alert(
      t("Impossible de confirmer ton identité"),
      t("Vérifie que Face ID/Touch ID est bien activé pour Horsetrack dans les réglages de ton téléphone, ou déconnecte-toi pour désactiver le verrouillage."),
      [
        { text: t("Annuler"), style: "cancel" },
        {
          text: t("Se déconnecter et désactiver le verrouillage"),
          style: "destructive",
          onPress: async () => {
            await setBiometricLockEnabled(false);
            // Comme profile.tsx signOut : le téléphone ne reçoit plus les
            // notifications du fil (texte des commentaires) de ce compte.
            await unregisterPushToken().catch(() => {});
            await supabase.auth.signOut();
            // Même navigation explicite qu'un déconnexion normale (cf.
            // profile.tsx signOut) : rien n'écoute les changements de
            // session pour rediriger automatiquement. `setStatus` retire le
            // verrou (overlay racine, au-dessus du Stack) pour révéler
            // l'écran de connexion qu'on vient de pousser en dessous.
            router.replace("/(auth)/login");
            setStatus("unlocked");
          },
        },
      ]
    );
  }

  useEffect(() => {
    // tryUnlock() est async et ne fait setStatus qu'après son await : pas un
    // setState synchrone dans l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === "locked") tryUnlock();
  }, [status]);

  if (status === "unlocked") {
    return covered ? <View className="absolute inset-0 z-50 bg-background" pointerEvents="none" accessibilityElementsHidden /> : null;
  }

  if (status === "checking") {
    return (
      <View className="absolute inset-0 z-50 items-center justify-center bg-background">
        <ActivityIndicator className="text-primary" />
      </View>
    );
  }

  return (
    <View className="absolute inset-0 z-50 items-center justify-center gap-4 bg-background px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
        <MaterialCommunityIcons name="shield-lock-outline" size={30} color={colors.primary} />
      </View>
      <Text className="text-center text-lg font-bold text-text">{t("Authentification requise")}</Text>
      <Text className="text-center text-sm text-muted">{t("Confirme ton identité pour accéder à Horsetrack.")}</Text>
      <TouchableOpacity
        onPress={tryUnlock}
        activeOpacity={0.85}
        className="rounded-card bg-primary px-6 py-3"
      >
        <Text className="text-base font-bold text-on-primary">{t("Déverrouiller")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={offerFallback} hitSlop={12}>
        <Text className="text-sm font-semibold text-muted">{t("Ça ne fonctionne pas ?")}</Text>
      </TouchableOpacity>
    </View>
  );
}
