import { Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Filet de sécurité affiché à la place d'un plantage complet de l'app quand
 * une erreur JS survient pendant un rendu, n'importe où dans l'arbre (cf.
 * Sentry.ErrorBoundary dans app/_layout.tsx). Avant ce composant, l'app
 * n'avait AUCUN error boundary : toute exception de rendu (ex: donnée
 * inattendue après la fusion final-release/main du 2026-09-11) fermait
 * l'app plutôt que d'afficher un message — indiagnosticable pour
 * l'utilisateur, et confondu avec un vrai crash natif.
 */
export function CrashFallback({ resetError }: { error: unknown; resetError: () => void }) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-8">
      <Text className="text-center text-2xl font-display tracking-tight text-text">Oups, un problème est survenu</Text>
      <Text className="text-center text-base text-muted">
        Une erreur inattendue a interrompu l&apos;affichage. Réessaie — si le problème persiste, redémarre l&apos;application.
      </Text>
      <TouchableOpacity onPress={resetError} className="mt-2 rounded-card bg-primary px-6 py-3" activeOpacity={0.85}>
        <Text className="text-base font-bold text-on-primary">Réessayer</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
