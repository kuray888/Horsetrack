import { Text, View } from "react-native";
import type { DisciplineBucket, DisciplineStat } from "@/stats/compute";

const BUCKET_META: Record<DisciplineBucket, { icon: string; color: string }> = {
  Dressage: { icon: "🐴", color: "bg-primary" },
  Obstacle: { icon: "🤸", color: "bg-accent" },
  Balade: { icon: "🌳", color: "bg-success" },
  "Travail à pied": { icon: "🔄", color: "bg-warning" },
  Renforcement: { icon: "💪", color: "bg-primary" },
  Repos: { icon: "😴", color: "bg-border" },
};

/** Barres de répartition par discipline — pas de bibliothèque de graphiques,
 * juste des View dont la largeur reflète le pourcentage (cf. stats/compute.ts). */
export function DisciplineBreakdownCard({ stats }: { stats: DisciplineStat[] }) {
  if (stats.length === 0) {
    return <Text className="text-sm text-muted">Pas encore assez d&apos;activité enregistrée pour une répartition.</Text>;
  }

  return (
    <View className="gap-2.5">
      {stats.map((s) => {
        const meta = BUCKET_META[s.bucket];
        return (
          <View key={s.bucket} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-text">
                {meta.icon} {s.bucket}
              </Text>
              <Text className="text-xs font-bold text-muted">
                {s.pct}% · {s.count}
              </Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-border">
              <View className={`h-2 rounded-full ${meta.color}`} style={{ width: `${s.pct}%` }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
