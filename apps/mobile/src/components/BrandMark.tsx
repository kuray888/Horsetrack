import { Image, type ImageStyle, type StyleProp } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

/**
 * Logo « h. » de Horsetrack. Le fichier est noir sur fond transparent : en
 * mode sombre il disparaissait sur le fond foncé, on le teinte alors de la
 * couleur du texte. En mode clair, il reste tel quel (noir).
 */
export function BrandMark({ size, style }: { size: number; style?: StyleProp<ImageStyle> }) {
  const { scheme, colors } = useTheme();
  return (
    <Image
      source={require("../../assets/logo-mark.png")}
      style={[{ width: size, height: size }, scheme === "dark" ? { tintColor: colors.text } : null, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessibilityLabel={t("Horsetrack")}
    />
  );
}
