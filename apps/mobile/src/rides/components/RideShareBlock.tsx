import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Switch, Text, TouchableOpacity, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { RideShareCard } from "@/rides/components/RideShareCard";
import { maskRouteEnds, type ShareFormat } from "@/rides/shareCardLogic";
import { decodePolyline } from "@/rides/rideMath";
import type { SessionRide } from "@/rides/types";
import { fetchReferral } from "@/lib/referral";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { hapticSelection } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

export type ShareSource = "ride_end" | "saved_ride" | "replay";

/**
 * Carte de séance à partager (story ou carré) avec ses choix : masquer le
 * départ et l'arrivée (200 m, activé d'office : l'écurie ou le domicile ne se
 * devinent pas) et afficher son code de parrainage. Chaque partage montre
 * l'app à d'autres cavaliers. Le tracé n'a pas de fond de carte.
 */
export function RideShareBlock({
  ride,
  horseName,
  horsePhoto,
  activity,
  source,
}: {
  ride: SessionRide;
  horseName: string | null;
  horsePhoto: string | null;
  activity: string;
  source: ShareSource;
}) {
  const colors = useThemeColors();
  const shareRef = useRef<View>(null);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [hideEnds, setHideEnds] = useState(true);
  const [withCode, setWithCode] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Le code vient du serveur : sans réseau (ou hors connexion), la carte n'en a simplement pas.
  useEffect(() => {
    let cancelled = false;
    fetchReferral()
      .then((info) => {
        if (!cancelled && info?.code) setCode(info.code);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fullRoute = useMemo(() => (ride.route ? decodePolyline(ride.route) : []), [ride.route]);
  const route = useMemo(() => (hideEnds ? maskRouteEnds(fullRoute, 200) : fullRoute), [fullRoute, hideEnds]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareRef, { format: "png", quality: 1, result: "tmpfile", width: 1080 });
      if (await Sharing.isAvailableAsync()) {
        await runNativeInteraction(() => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" }));
        track("ride_shared", {
          gps: ride.gps,
          minutes: Math.round(ride.durationSeconds / 60),
          source,
          format,
          with_code: withCode && !!code,
          ends_hidden: hideEnds,
        });
      }
    } catch {
      Alert.alert(t("Partage impossible"), t("L'image n'a pas pu être préparée. Réessaie dans un instant."));
    } finally {
      setSharing(false);
    }
  }

  const FORMATS: { value: ShareFormat; label: string }[] = [
    { value: "story", label: t("Story") },
    { value: "square", label: t("Carré") },
  ];

  return (
    <View className="items-center gap-4">
      <RideShareCard
        ref={shareRef}
        ride={ride}
        route={route}
        horseName={horseName}
        horsePhoto={horsePhoto}
        activity={activity}
        format={format}
        code={withCode ? code : null}
      />

      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        {FORMATS.map((f) => {
          const active = f.value === format;
          return (
            <TouchableOpacity
              key={f.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => {
                hapticSelection();
                setFormat(f.value);
              }}
              className={`min-h-[44px] items-center justify-center rounded-full border px-5 ${active ? "border-primary bg-primary" : "border-border"}`}
            >
              <Text className={`text-[15px] font-semibold ${active ? "text-on-primary" : "text-text"}`}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="gap-3 self-stretch">
        {ride.gps && fullRoute.length > 1 ? (
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-[15px] font-semibold text-text">{t("Masquer le départ et l'arrivée")}</Text>
              <Text className="text-[13px] text-muted">{t("Retire les 200 premiers et derniers mètres du tracé, pour qu'on ne devine pas d'où tu pars.")}</Text>
            </View>
            <Switch value={hideEnds} onValueChange={(v) => { hapticSelection(); setHideEnds(v); }} accessibilityLabel={t("Masquer le départ et l'arrivée")} />
          </View>
        ) : null}
        {code ? (
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-[15px] font-semibold text-text">{t("Afficher mon code de parrainage")}</Text>
              <Text className="text-[13px] text-muted">{t("Quand un ami l'utilise et s'abonne, tu gagnes un mois de Premium.")}</Text>
            </View>
            <Switch value={withCode} onValueChange={(v) => { hapticSelection(); setWithCode(v); }} accessibilityLabel={t("Afficher mon code de parrainage")} />
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => void handleShare()}
        disabled={sharing}
        accessibilityRole="button"
        accessibilityState={{ disabled: sharing }}
        className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-primary px-5 py-2"
      >
        <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.primary} accessibilityElementsHidden />
        <Text className="text-[15px] font-bold text-primary">{sharing ? t("Un instant…") : t("Partager ma séance")}</Text>
      </TouchableOpacity>
    </View>
  );
}
