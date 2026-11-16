import { Text, TouchableOpacity, View } from "react-native";
import { hapticSelection } from "@/lib/haptics";
import type { MapStyle } from "@/rides/mapViewLogic";
import { t } from "@/i18n";

/** Choix du fond de carte sous le tracé : boutons ronds, un toucher. */
export function MapStylePicker({
  styles,
  value,
  onChange,
  noneLabel,
}: {
  styles: MapStyle[];
  value: MapStyle;
  onChange: (style: MapStyle) => void;
  /** Libellé du choix « sans fond de carte ». */
  noneLabel: string;
}) {
  const label: Record<MapStyle, string> = {
    trace: noneLabel,
    standard: t("Plan"),
    satellite: t("Satellite"),
    "3d": t("3D"),
  };
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel={t("Fond de carte")}>
      {styles.map((s) => {
        const active = s === value;
        return (
          <TouchableOpacity
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label[s]}
            onPress={() => {
              if (active) return;
              hapticSelection();
              onChange(s);
            }}
            className={`min-h-[36px] items-center justify-center rounded-full border px-4 ${active ? "border-primary bg-primary" : "border-border"}`}
          >
            <Text className={`text-footnote font-semibold ${active ? "text-on-primary" : "text-text"}`}>{label[s]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
