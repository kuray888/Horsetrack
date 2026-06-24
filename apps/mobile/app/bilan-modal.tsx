import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { useHorses } from "@/horses/store";
import { useProgram } from "@/program/store";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Bilan de fin de programme — proposé sur Today une fois la dernière semaine
 * atteinte (cf. useProgram().isProgramComplete). Renvoie vers les formulaires
 * d'édition existants (cheval / cavalier) pour capter ce qui a changé, puis
 * régénère le programme à partir du profil mis à jour. */
export default function BilanModal() {
  const { selectedHorse } = useHorses();
  const { regenerate, dismissBilan } = useProgram();

  function later() {
    dismissBilan();
    router.back();
  }

  function finish() {
    regenerate();
    dismissBilan();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text">Bilan</Text>
        <TouchableOpacity onPress={later} hitSlop={12}>
          <Text className="text-xl text-muted">✕</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 gap-5 px-5 pt-6">
        <View className="items-center gap-2">
          <Text className="text-4xl">🎉</Text>
          <Text className="text-center text-lg font-bold text-text">
            Tu as terminé le programme de {selectedHorse?.name ?? "ton cheval"} !
          </Text>
          <Text className="text-center text-sm leading-5 text-muted">
            Avant de repartir, dis-nous ce qui a changé pour adapter le prochain programme : forme, blessures,
            objectifs, ce qui s&apos;est bien ou mal passé.
          </Text>
        </View>

        {selectedHorse ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/edit-horse-modal", params: { id: selectedHorse.id } })}
            activeOpacity={0.85}
            className={`${CARD} flex-row items-center gap-3`}
          >
            <Text className="text-2xl">🐴</Text>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-text">Mettre à jour {selectedHorse.name}</Text>
              <Text className="text-sm text-muted">Forme, charge de travail, blessures…</Text>
            </View>
            <Text className="text-base text-muted">›</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={() => router.push("/edit-rider-modal")}
          activeOpacity={0.85}
          className={`${CARD} flex-row items-center gap-3`}
        >
          <Text className="text-2xl">🙋</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-bold text-text">Mettre à jour mon profil</Text>
            <Text className="text-sm text-muted">Objectif, fréquence, notes pour Julien…</Text>
          </View>
          <Text className="text-base text-muted">›</Text>
        </TouchableOpacity>
      </View>

      <View className="gap-2 px-5 pb-2 pt-3">
        <PrimaryButton label="Générer mon nouveau programme" onPress={finish} />
        <TouchableOpacity onPress={later} activeOpacity={0.7} className="items-center py-2">
          <Text className="text-sm font-semibold text-muted">Plus tard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
