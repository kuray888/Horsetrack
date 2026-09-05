export type WidgetData = {
  horseName: string;
  todaySessionTitle: string | null;
  todaySessionDurationMin: number | null;
  todaySessionTime: string | null;
  weeklyDone: number;
  weeklyTotal: number;
};

/** Widget iOS temporairement désactivé — @bacons/apple-targets n'a pas encore
 *  de version compatible avec Expo SDK 57. */
export async function pushWidgetData(_data: WidgetData): Promise<void> {
  // no-op
}
