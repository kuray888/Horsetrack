export type BadgeContext = {
  completedCount: number;
  totalSessions: number;
  weekStreak: number;
  bestWeekStreak: number;
};

export type Badge = {
  id: string;
  label: string;
  description: string;
  icon: string;
  isUnlocked: (ctx: BadgeContext) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: "first_session",
    label: "Premier pas",
    description: "Termine ta première séance",
    icon: "🐣",
    isUnlocked: (c) => c.completedCount >= 1,
  },
  {
    id: "five_sessions",
    label: "Sur la lancée",
    description: "Termine 5 séances",
    icon: "🔥",
    isUnlocked: (c) => c.completedCount >= 5,
  },
  {
    id: "ten_sessions",
    label: "Régulier",
    description: "Termine 10 séances",
    icon: "💪",
    isUnlocked: (c) => c.completedCount >= 10,
  },
  {
    id: "halfway",
    label: "À mi-parcours",
    description: "Termine la moitié du programme",
    icon: "🎯",
    isUnlocked: (c) => c.totalSessions > 0 && c.completedCount >= c.totalSessions / 2,
  },
  {
    id: "full_program",
    label: "Programme terminé",
    description: "Termine tout le programme",
    icon: "🏆",
    isUnlocked: (c) => c.totalSessions > 0 && c.completedCount >= c.totalSessions,
  },
  {
    id: "two_week_streak",
    label: "Deux semaines parfaites",
    description: "2 semaines complètes d'affilée",
    icon: "⚡",
    isUnlocked: (c) => c.weekStreak >= 2,
  },
  {
    id: "four_week_streak",
    label: "Un mois sans faille",
    description: "4 semaines complètes d'affilée",
    icon: "🌟",
    isUnlocked: (c) => c.weekStreak >= 4,
  },
];

export function unlockedBadgeIds(ctx: BadgeContext): string[] {
  return BADGES.filter((b) => b.isUnlocked(ctx)).map((b) => b.id);
}
