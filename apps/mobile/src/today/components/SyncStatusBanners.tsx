import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { retryPendingWrites } from "@/lib/cloudSync";
import { t } from "@/i18n";

/**
 * État de la sauvegarde, en tête de l'Accueil : rien de ce qui suit ne doit
 * passer devant un risque de perte de données.
 */
export function SyncStatusBanners({
  saveFailed,
  pendingSync,
  rejectedSync,
  onRetryRejected,
}: {
  saveFailed: boolean;
  pendingSync: number;
  rejectedSync: number;
  onRetryRejected: () => void;
}) {
  const colors = useThemeColors();
  return (
    <>
      {/* Sauvegarde locale en échec (disque plein, fichier inaccessible) —
          au-dessus de tout le reste : tant que ça dure, rien de ce qui est
          saisi ne survivra à la fermeture de l'app. L'alerte de
          lib/localStore.ts ne passe qu'une fois par session ; cette bannière,
          elle, reste tant que le problème dure. */}
      {saveFailed ? (
        <FadeInView delay={50}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-danger/15 p-3.5">
            <MaterialCommunityIcons name="content-save-off-outline" size={18} color={colors.danger} />
            <Text className="flex-1 text-sm text-text">
              {t("Tes dernières modifications n'ont pas pu être enregistrées sur cet appareil. Vérifie l'espace de stockage disponible.")}
            </Text>
          </View>
        </FadeInView>
      ) : null}

      {/* Sauvegarde cloud en retard — dit ce qui n'est PAS encore parti,
          plutôt que de laisser croire que tout est à l'abri. Les données sont
          bien enregistrées sur l'appareil : c'est une information, pas une
          alerte, d'où le ton et la couleur plus calmes que la bannière
          ci-dessus. La reprise est automatique (démarrage, retour au premier
          plan) ; le bouton permet juste de ne pas attendre. */}
      {pendingSync > 0 ? (
        <FadeInView delay={55}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5">
            <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">
              {pendingSync === 1
                ? t("1 modification enregistrée sur cet appareil attend la sauvegarde en ligne.")
                : t("{pendingSync} modifications enregistrées sur cet appareil attendent la sauvegarde en ligne.", { pendingSync: pendingSync })}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => retryPendingWrites().catch(() => {})} hitSlop={8}>
              <Text className="text-sm font-bold text-warning">{t("Réessayer")}</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}

      {/* Écritures REFUSÉES par le serveur (pas un problème de réseau) : dit
          que ces saisies ne sont pas sauvegardées en ligne, au lieu de laisser
          croire le contraire (cf. lib/rejectedWrites.ts). Renvoyées à chaque
          relecture ; le bouton relance la relecture sans attendre. */}
      {rejectedSync > 0 ? (
        <FadeInView delay={56}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-danger/15 p-3.5">
            <MaterialCommunityIcons name="cloud-alert-outline" size={18} color={colors.danger} />
            <Text className="flex-1 text-sm text-text">
              {rejectedSync === 1
                ? t("1 modification a été refusée par le serveur : elle n'est pas sauvegardée en ligne. Si ça persiste, contacte le support.")
                : t("{rejectedSync} modifications ont été refusées par le serveur : elles ne sont pas sauvegardées en ligne. Si ça persiste, contacte le support.", { rejectedSync: rejectedSync })}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={onRetryRejected} hitSlop={8}>
              <Text className="text-sm font-bold text-danger">{t("Réessayer")}</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}
    </>
  );
}
