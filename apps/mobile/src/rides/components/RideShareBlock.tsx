import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Share, Switch, Text, TouchableOpacity, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { RideShareCard } from "@/rides/components/RideShareCard";
import { shareRoute, type ShareFormat } from "@/rides/shareCardLogic";
import { parseTrace, traceSpeedsKmh } from "@/rides/trace";
import { mapAvailable, SHARE_MAP_STYLES, type MapStyle } from "@/rides/mapViewLogic";
import { MapStylePicker } from "@/rides/components/MapStylePicker";
import { decodePolyline } from "@/rides/rideMath";
import type { SessionRide } from "@/rides/types";
import { fetchReferral } from "@/lib/referral";
import { createPublicLink, getStoredLink, revokePublicLink, type PublicLink } from "@/rides/publicLink";
import { buildPublicRidePayload } from "@/rides/publicLinkLogic";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { hapticSelection } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

export type ShareSource = "ride_end" | "saved_ride" | "replay";

const HAS_MAP = mapAvailable(Platform.OS);

/**
 * Carte de séance à partager (story ou carré) avec ses choix : masquer le
 * départ et l'arrivée (200 m, activé d'office : l'écurie ou le domicile ne se
 * devinent pas) et afficher son code de parrainage. Chaque partage montre
 * l'app à d'autres cavaliers. Le tracé n'a pas de fond de carte, sauf si on
 * en choisit un (iPhone : Apple Plans, plan ou satellite) — jamais d'office.
 */
export function RideShareBlock({
  ride,
  horseName,
  horsePhoto,
  activity,
  source,
  sessionId,
}: {
  ride: SessionRide;
  horseName: string | null;
  horsePhoto: string | null;
  activity: string;
  source: ShareSource;
  /** Séance enregistrée : permet le lien public (pas à la fin d'une séance, pas encore enregistrée). */
  sessionId?: string;
}) {
  const colors = useThemeColors();
  const shareRef = useRef<View>(null);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [hideEnds, setHideEnds] = useState(true);
  const [withCode, setWithCode] = useState(true);
  const [showHorseName, setShowHorseName] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [link, setLink] = useState<PublicLink | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>("trace");
  const [mapReady, setMapReady] = useState(false);

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

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getStoredLink(sessionId)
      .then((l) => {
        if (!cancelled) setLink(l);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const fullRoute = useMemo(() => (ride.route ? decodePolyline(ride.route) : []), [ride.route]);
  const fullSpeeds = useMemo(
    () => traceSpeedsKmh(parseTrace(ride.trace, fullRoute.length), fullRoute.length),
    [ride.trace, fullRoute.length]
  );
  const { route, speeds } = useMemo(() => shareRoute(fullRoute, fullSpeeds, hideEnds), [fullRoute, fullSpeeds, hideEnds]);

  function chooseMapStyle(next: MapStyle) {
    setMapReady(false);
    setMapStyle(next);
    track("ride_map_style_changed", { style: next, source: "share" });
  }

  const withMap = mapStyle !== "trace" && route.length > 1;
  // Fond de carte pas encore chargé : la capture serait une carte grise.
  const waitingMap = withMap && !mapReady;

  // Hors ligne, le fond ne se charge jamais : on n'attend pas plus de 6 s
  // (la carte partagée garde alors le tracé sur un fond uni).
  useEffect(() => {
    if (!waitingMap) return;
    const timer = setTimeout(() => setMapReady(true), 6000);
    return () => clearTimeout(timer);
  }, [waitingMap]);

  async function handleShare() {
    if (sharing || waitingMap) return;
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
          map_style: withMap ? mapStyle : "trace",
        });
      }
    } catch {
      Alert.alert(t("Partage impossible"), t("L'image n'a pas pu être préparée. Réessaie dans un instant."));
    } finally {
      setSharing(false);
    }
  }

  // Lien public : toujours volontaire, expliqué avant l'envoi, supprimable.
  function handleCreateLink() {
    if (!sessionId || linkBusy) return;
    Alert.alert(
      t("Créer un lien public ?"),
      t("Toute personne qui a le lien verra le nom du cheval, la date, la durée, la distance et le tracé{ends}. Pas ton nom. Tu peux supprimer le lien quand tu veux.", {
        ends: hideEnds ? t(" (sans le départ ni l'arrivée)") : "",
      }),
      [
        { text: t("Annuler"), style: "cancel" },
        {
          text: t("Créer le lien"),
          onPress: async () => {
            setLinkBusy(true);
            const created = await createPublicLink(
              buildPublicRidePayload({ ride, sessionId, horseName, activity, fullRoute, hideEnds, showHorseName })
            );
            setLinkBusy(false);
            if (!created) {
              Alert.alert(t("Lien impossible"), t("Le lien n'a pas pu être créé. Vérifie ta connexion et réessaie."));
              return;
            }
            setLink(created);
            track("ride_link_created", { ends_hidden: hideEnds, source });
            await Share.share({ message: t("Ma balade sur Horsetrack : {url}", { url: created.url }) }).catch(() => {});
          },
        },
      ]
    );
  }

  async function handleShareLink() {
    if (!link) return;
    track("ride_link_shared", { source });
    await Share.share({ message: t("Ma balade sur Horsetrack : {url}", { url: link.url }) }).catch(() => {});
  }

  async function handleRevokeLink() {
    if (!link || !sessionId || linkBusy) return;
    setLinkBusy(true);
    const ok = await revokePublicLink(sessionId, link.token);
    setLinkBusy(false);
    if (ok) {
      setLink(null);
      track("ride_link_revoked", { source });
    } else {
      Alert.alert(t("Suppression impossible"), t("Le lien n'a pas pu être supprimé. Vérifie ta connexion et réessaie."));
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
        speedsKmh={speeds}
        horseName={horseName}
        horsePhoto={horsePhoto}
        activity={activity}
        format={format}
        code={withCode ? code : null}
        mapStyle={withMap ? mapStyle : "trace"}
        onMapReady={() => setMapReady(true)}
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
              <Text className={`text-subhead font-semibold ${active ? "text-on-primary" : "text-text"}`}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="gap-3 self-stretch">
        {HAS_MAP && ride.gps && fullRoute.length > 1 ? (
          <View className="gap-2">
            <Text className="text-subhead font-semibold text-text">{t("Fond de carte")}</Text>
            <MapStylePicker styles={SHARE_MAP_STYLES} value={mapStyle} onChange={chooseMapStyle} noneLabel={t("Aucun")} />
            {mapStyle !== "trace" ? (
              <Text className="text-footnote text-muted">
                {hideEnds
                  ? t("La carte montre les environs de ta balade. Le départ et l'arrivée restent masqués.")
                  : t("La carte montre les environs de ta balade, départ et arrivée compris : on peut deviner d'où tu pars.")}
              </Text>
            ) : null}
          </View>
        ) : null}
        {ride.gps && fullRoute.length > 1 ? (
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-subhead font-semibold text-text">{t("Masquer le départ et l'arrivée")}</Text>
              <Text className="text-footnote text-muted">{t("Retire les 200 premiers et derniers mètres du tracé, pour qu'on ne devine pas d'où tu pars.")}</Text>
            </View>
            <Switch value={hideEnds} onValueChange={(v) => { hapticSelection(); setHideEnds(v); }} accessibilityLabel={t("Masquer le départ et l'arrivée")} />
          </View>
        ) : null}
        {horseName ? (
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-subhead font-semibold text-text">{t("Afficher le nom du cheval sur le lien")}</Text>
              <Text className="text-footnote text-muted">{t("Par défaut, la page web du lien ne montre pas le nom de ton cheval.")}</Text>
            </View>
            <Switch value={showHorseName} onValueChange={(v) => { hapticSelection(); setShowHorseName(v); }} accessibilityLabel={t("Afficher le nom du cheval sur le lien")} />
          </View>
        ) : null}
        {code ? (
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-subhead font-semibold text-text">{t("Afficher mon code de parrainage")}</Text>
              <Text className="text-footnote text-muted">{t("Quand un ami l'utilise et s'abonne, tu gagnes un mois de Premium.")}</Text>
            </View>
            <Switch value={withCode} onValueChange={(v) => { hapticSelection(); setWithCode(v); }} accessibilityLabel={t("Afficher mon code de parrainage")} />
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => void handleShare()}
        disabled={sharing || waitingMap}
        accessibilityRole="button"
        accessibilityState={{ disabled: sharing || waitingMap }}
        className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-primary px-5 py-2"
      >
        <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.primary} accessibilityElementsHidden />
        <Text className="text-subhead font-bold text-primary">{sharing || waitingMap ? t("Un instant…") : t("Partager ma séance")}</Text>
      </TouchableOpacity>

      {sessionId && ride.gps ? (
        <View className="gap-3 self-stretch rounded-card bg-surface p-5 shadow-card">
          <Text className="text-body font-semibold text-text">{t("Lien à partager")}</Text>
          <Text className="text-footnote text-muted">
            {link
              ? t("Ton lien est actif : ceux qui l'ont voient ta balade sur une page Horsetrack.")
              : t("Une page web de ta balade (tracé, durée, distance), à envoyer par message. Tu choisis de la créer, et tu peux la supprimer.")}
          </Text>
          {link ? (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => void handleShareLink()}
                accessibilityRole="button"
                className="min-h-[44px] flex-1 items-center justify-center rounded-full border border-primary"
              >
                <Text className="text-subhead font-bold text-primary">{t("Partager le lien")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleRevokeLink()}
                disabled={linkBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: linkBusy }}
                className="min-h-[44px] flex-1 items-center justify-center rounded-full border border-border"
              >
                <Text className="text-subhead font-semibold text-danger">{linkBusy ? t("Un instant…") : t("Supprimer le lien")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCreateLink}
              disabled={linkBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: linkBusy }}
              className="min-h-[44px] items-center justify-center rounded-full border border-primary"
            >
              <Text className="text-subhead font-bold text-primary">{linkBusy ? t("Un instant…") : t("Créer un lien à partager")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}
