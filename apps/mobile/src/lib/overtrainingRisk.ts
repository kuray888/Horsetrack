import type { Horse } from "@/horses/store";
import type { WorkloadResult } from "@/stats/compute";
import type { FeedbackTrend } from "@/program/types";

export type RiskLevel = "none" | "caution" | "alert";

export type OvertrainingRisk = {
  level: RiskLevel;
  title: string;
  message: string;
  /**
   * True quand feedbackTrend === -1 : le programme des prochaines semaines
   * a déjà été allégé automatiquement (cf. program/store.tsx shiftIntensity).
   * Permet d'informer l'utilisateur que l'app a déjà agi, pas seulement de l'alerter.
   */
  programAdapted: boolean;
};

const NONE: OvertrainingRisk = { level: "none", title: "", message: "", programAdapted: false };

export function computeOvertrainingRisk(
  feedbackTrend: FeedbackTrend,
  workload: WorkloadResult,
  horse: Horse | null
): OvertrainingRisk {
  const name = horse?.name ?? "Ton cheval";
  const activeInjuries = horse?.injuries.filter((i) => i.recoveryStatus !== "RECOVERED") ?? [];
  const hasInjury = activeInjuries.length > 0;
  const isHighLoad = workload.level === "ELEVEE" || workload.level === "TRES_ELEVEE";
  const isVeryHighLoad = workload.level === "TRES_ELEVEE";
  const hardSessions = feedbackTrend === -1;

  // ── Niveau ALERT : plusieurs facteurs combinés ────────────────────────────
  if (hardSessions && isHighLoad) {
    return {
      level: "alert",
      title: "⚠️ Risque de surmenage détecté",
      message: `${name} accumule des séances difficiles avec une charge élevée${
        hasInjury ? " et a une blessure en cours de guérison" : ""
      }. Les prochaines semaines ont été allégées automatiquement.`,
      programAdapted: true,
    };
  }

  if (hardSessions && hasInjury) {
    return {
      level: "alert",
      title: "⚠️ Attention — blessure + séances difficiles",
      message: `Plusieurs séances récentes ressenties comme difficiles, et ${name} a une blessure signalée. Le programme a été adapté en conséquence.`,
      programAdapted: true,
    };
  }

  // ── Niveau CAUTION : facteur isolé ───────────────────────────────────────
  if (hardSessions) {
    return {
      level: "caution",
      title: "🟡 Séances récentes difficiles",
      message: `Les dernières séances ont été ressenties comme difficiles. Le programme allège les prochaines séances automatiquement — surveille la récupération de ${name}.`,
      programAdapted: true,
    };
  }

  if (isVeryHighLoad) {
    return {
      level: "caution",
      title: "🟡 Charge d'entraînement très élevée",
      message: `La charge des 14 derniers jours est très élevée. Pense à prévoir un temps de récupération suffisant pour ${name}.`,
      programAdapted: false,
    };
  }

  if (hasInjury && isHighLoad) {
    return {
      level: "caution",
      title: "🟡 Blessure en cours — charge à surveiller",
      message: `${name} est en rééducation et la charge actuelle est élevée. Reste attentif aux signaux d'inconfort.`,
      programAdapted: false,
    };
  }

  return NONE;
}
