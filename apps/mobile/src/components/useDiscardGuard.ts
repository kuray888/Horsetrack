import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { t } from "@/i18n";

/**
 * Confirmation avant de perdre une saisie : fermer une fenêtre de formulaire
 * (croix, glissement vers le bas, retour) effaçait sans prévenir ce qui
 * venait d'être tapé. Tant que `dirty` est vrai, la fermeture demande
 * « Abandonner les modifications ? » (et iOS retient la feuille pendant le
 * glissement).
 *
 * Après un enregistrement ou une suppression, fermer avec `leave()` (et non
 * `router.back()`) : la garde est levée d'abord, puis la fenêtre se ferme.
 */
export function useDiscardGuard(dirty: boolean): { leave: (after?: () => void) => void } {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  const afterRef = useRef<(() => void) | null>(null);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert(t("Abandonner les modifications ?"), t("Ce que tu as saisi ne sera pas enregistré."), [
      { text: t("Continuer la saisie"), style: "cancel" },
      { text: t("Abandonner"), style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  useEffect(() => {
    if (!leaving) return;
    if (router.canGoBack()) router.back();
    afterRef.current?.();
    afterRef.current = null;
  }, [leaving]);

  return {
    // `after` : action à faire une fois la fenêtre fermée (ex. supprimer le
    // cheval affiché, qui démonterait le formulaire avant sa fermeture).
    leave: (after) => {
      afterRef.current = after ?? null;
      setLeaving(true);
    },
  };
}

/** Deux dates égales au jour près, `null` compris (champ date facultatif). */
export function sameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.toDateString() === b.toDateString();
}
