import { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

const INPUT = "rounded-card border border-border bg-surface p-4 pr-11 text-base text-text";

/**
 * Champ mot de passe avec l'œil pour afficher/masquer la saisie — commun à la
 * connexion, l'inscription, la réinitialisation et le changement de mot de
 * passe. Visibilité gérée ici par défaut ; `visible`/`onToggleVisible`
 * permettent à l'écran de la piloter lui-même.
 */
export function PasswordInput({
  value,
  onChangeText,
  placeholder,
  autoComplete,
  visible: visibleProp,
  onToggleVisible,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  /** Mot de passe existant (connexion) ou nouveau (inscription, changement) :
   * guide le trousseau iOS (remplissage, proposition de mot de passe fort). */
  autoComplete: "current-password" | "new-password";
  visible?: boolean;
  onToggleVisible?: () => void;
}) {
  const colors = useThemeColors();
  const [visibleState, setVisibleState] = useState(false);
  const visible = visibleProp ?? visibleState;
  const toggle = onToggleVisible ?? (() => setVisibleState((v) => !v));

  return (
    <View className="relative justify-center">
      <TextInput
        className={INPUT}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === "current-password" ? "password" : "newPassword"}
      />
      <TouchableOpacity
        onPress={toggle}
        hitSlop={12}
        className="absolute right-3"
        accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
