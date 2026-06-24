import { useEffect, useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CircularProgress } from "@/components/CircularProgress";
import { colors } from "@/theme/colors";
import { useOnboarding } from "@/onboarding/store";

const STEPS = [
  "Analyse de ton profil cavalier…",
  "Prise en compte de ton écurie…",
  "Calibrage des séances…",
  "Construction de ton programme…",
];

export default function Building() {
  const { horses } = useOnboarding();
  const [progress, setProgress] = useState(0);
  const primary = horses.find((h) => h.isPrimary) ?? horses[0];

  useEffect(() => {
    const start = Date.now();
    const duration = 3200;
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / duration);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        router.replace("/(onboarding)/summary");
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  const stepIndex = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <CircularProgress
        progress={progress}
        size={160}
        strokeWidth={14}
        trackColor={colors.border}
        progressColor={colors.primary}
      >
        <Text className="text-3xl font-extrabold text-text">{Math.round(progress * 100)}%</Text>
      </CircularProgress>

      <Text className="mt-8 text-center text-xl font-bold text-text">
        On prépare le programme de {primary?.name?.trim() || "ton cheval"}
      </Text>
      <Text className="mt-2 text-center text-base text-muted">{STEPS[stepIndex]}</Text>
    </SafeAreaView>
  );
}
