import type { HorseRecoveryStatus } from "@/onboarding/store";

/** Sous-ensemble de `Injury` (cf. horses/store.tsx) dont ce module a besoin —
 * évite d'importer le store (react-native, expo-secure-store...) et garde ce
 * fichier testable en isolation avec vitest. */
export type InjuryRecord = {
  id: string;
  type: string;
  occurredAt: Date | null;
  recoveryStatus: HorseRecoveryStatus | null;
  note: string;
};

export function generateInjuryId(): string {
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Plus récent d'abord ; celles sans date connue en dernier (on ne sait pas où
 * les placer, autant ne pas les faire passer devant des blessures datées). À
 * date égale, l'ordre d'origine est conservé. */
export function sortInjuriesRecentFirst<T extends InjuryRecord>(injuries: T[]): T[] {
  return injuries
    .map((injury, index) => ({ injury, index }))
    .sort((a, b) => {
      const ta = a.injury.occurredAt ? a.injury.occurredAt.getTime() : null;
      const tb = b.injury.occurredAt ? b.injury.occurredAt.getTime() : null;
      if (ta === null && tb === null) return a.index - b.index;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta || a.index - b.index;
    })
    .map((entry) => entry.injury);
}

/** Une blessure est "ouverte" tant qu'elle n'est pas complètement rétablie. */
export function isInjuryOpen(injury: InjuryRecord): boolean {
  return injury.recoveryStatus !== "RECOVERED";
}

export function markInjuryRecovered<T extends InjuryRecord>(injuries: T[], id: string): T[] {
  return injuries.map((injury) => (injury.id === id ? { ...injury, recoveryStatus: "RECOVERED" as const } : injury));
}

/** Message d'alerte pour l'Accueil — uniquement pour une récupération EN COURS.
 * Une "séquelle à surveiller" est un état chronique qui peut durer des années :
 * en faire une bannière permanente serait de l'anxiété gratuite, et on
 * apprendrait à l'ignorer (cf. brief "évite les alertes inutiles ou
 * anxiogènes", horses/alerts.ts). L'alerte disparaît dès que la blessure est
 * marquée rétablie depuis l'écran Santé. */
export function recoveryAlertMessage(injuries: InjuryRecord[]): string | null {
  const inProgress = injuries.filter((i) => i.recoveryStatus === "IN_PROGRESS");
  if (inProgress.length === 0) return null;
  if (inProgress.length === 1) return `Récupération en cours : ${inProgress[0].type}`;
  return `${inProgress.length} blessures en cours de récupération`;
}
