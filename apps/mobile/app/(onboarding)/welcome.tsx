import { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { track } from "@/lib/analytics";
import { BrandMark } from "@/components/BrandMark";
import { useOnboarding } from "@/onboarding/store";
import { hasResumableDraft } from "@/onboarding/draftPersistence";
import { t } from "@/i18n";

/**
 * Deux parcours dès l'accueil :
 * - « J'ai un cheval » : le cheval d'abord (valeur visible en 1 minute, cf.
 *   summary.tsx), le compte à la fin pour garder ce qui vient d'être créé ;
 * - « On m'a invité·e » : demi-pension, coach, groom — le compte d'abord,
 *   pour accepter le partage sans inventer de cheval (cf. pending-invites).
 * Un brouillon sauvegardé (app fermée pendant la confirmation de l'e-mail,
 * par exemple) se reprend d'un toucher, directement au récapitulatif.
 */
export default function Welcome() {
  const { horses, hydrated, setFlow, reset } = useOnboarding();
  const resumable = hydrated && hasResumableDraft({ horses });
  const resumeName = horses.find((h) => h.isPrimary)?.name.trim() || horses.find((h) => h.name.trim())?.name.trim();

  useEffect(() => {
    track("onboarding_step_viewed", { step: "welcome" });
  }, []);

  function chooseOwner() {
    track("onboarding_path_chosen", { path: "owner" });
    setFlow("owner");
    router.push("/(onboarding)/rider-level");
  }

  function restart() {
    reset();
    chooseOwner();
  }

  function chooseInvited() {
    track("onboarding_path_chosen", { path: "invited" });
    setFlow("invited");
    router.push("/(onboarding)/account");
  }

  function resume() {
    track("onboarding_path_chosen", { path: "resume" });
    setFlow("owner");
    router.push("/(onboarding)/summary");
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center px-6">
        <FadeInView>
          <BrandMark size={96} />
        </FadeInView>
        <FadeInView delay={100}>
          <Text className="mt-6 text-4xl font-display leading-tight tracking-tight text-text">
            {t("Toi et ton cheval, organisés.")}
          </Text>
        </FadeInView>
        <FadeInView delay={200}>
          <Text className="mt-4 text-lg text-muted">
            {t("Planning, rendez-vous santé, concours et suivi financier au même endroit, pour progresser ensemble — quelle que soit ta discipline.")}
          </Text>
        </FadeInView>
      </View>

      <FadeInView delay={300}>
        <View className="gap-3 px-6 pb-2">
          {resumable && resumeName ? (
            <PrimaryButton testID="welcome-resume" label={t("Reprendre avec {name}", { name: resumeName })} onPress={resume} />
          ) : (
            <PrimaryButton testID="welcome-start" label={t("J'ai un cheval")} onPress={chooseOwner} />
          )}
          {resumable ? (
            <TouchableOpacity testID="welcome-restart" accessibilityRole="button" onPress={restart} hitSlop={8} className="py-2">
              <Text className="text-center text-sm font-semibold text-accent">{t("Recommencer avec un autre cheval")}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            testID="welcome-invited"
            accessibilityRole="button"
            onPress={chooseInvited}
            className="items-center rounded-card border border-border p-4"
          >
            <Text className="text-base font-semibold text-text">{t("On m'a invité·e sur un cheval")}</Text>
            <Text className="text-xs text-muted">{t("Demi-pension, coach, groom")}</Text>
          </TouchableOpacity>
          <Text className="text-center text-xs text-muted">
            {t("Gratuit pour commencer · Premium en option")}
          </Text>
          {/* Cavalier qui revient (nouveau téléphone, réinstallation) : droit
              à la connexion, sans passer par le formulaire de création. */}
          <TouchableOpacity
            testID="welcome-login"
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/login")}
            hitSlop={8}
            className="py-2"
          >
            <Text className="text-center text-sm font-semibold text-accent">{t("Déjà un compte ? Se connecter")}</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}
