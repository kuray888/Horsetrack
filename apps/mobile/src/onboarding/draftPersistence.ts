import type { HorseDraft, InjuryDraft, OnboardingFlow, RiderDraft } from "./store";

/**
 * Brouillon d'onboarding sauvegardé sur l'appareil — logique pure, testable.
 *
 * Le compte se crée maintenant APRÈS le cheval (cf. (onboarding)/welcome.tsx) :
 * entre les deux, le cavalier peut quitter l'app pour confirmer son adresse
 * e-mail, et iOS peut la fermer. Sans sauvegarde, il retrouvait un
 * formulaire vide. Le brouillon est effacé à la fin de l'onboarding (cf.
 * onboarding/completion.ts).
 */
export const DRAFT_KEY = "onboarding_draft_v1";

export type DraftState = {
  rider: RiderDraft;
  horses: HorseDraft[];
  editingIndex: number;
  flow: OnboardingFlow | null;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reviveDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Relit un brouillon sauvegardé. Tolérant aux évolutions : un champ ajouté
 * depuis la sauvegarde prend sa valeur par défaut (`makeHorse`). Renvoie null
 * pour tout ce qui ne ressemble pas à un brouillon — on repart alors d'un
 * onboarding vierge plutôt que d'un état incohérent.
 */
export function reviveDraft(raw: unknown, makeHorse: (isPrimary: boolean) => HorseDraft): DraftState | null {
  if (!isObject(raw) || !isObject(raw.rider) || !Array.isArray(raw.horses) || raw.horses.length === 0) return null;
  const horses: HorseDraft[] = [];
  for (const h of raw.horses) {
    if (!isObject(h) || typeof h.localId !== "string") return null;
    const base = makeHorse(h.isPrimary === true);
    const injuries: InjuryDraft[] = Array.isArray(h.injuries)
      ? h.injuries.filter(isObject).map((i) => ({
          localId: String(i.localId ?? ""),
          type: String(i.type ?? ""),
          occurredAt: reviveDate(i.occurredAt),
          recoveryStatus: (i.recoveryStatus as InjuryDraft["recoveryStatus"]) ?? null,
          note: String(i.note ?? ""),
        }))
      : [];
    horses.push({ ...base, ...(h as Partial<HorseDraft>), localId: h.localId, injuries });
  }
  if (!horses.some((h) => h.isPrimary)) horses[0] = { ...horses[0], isPrimary: true };
  const index = typeof raw.editingIndex === "number" ? raw.editingIndex : 0;
  const flow = raw.flow === "owner" || raw.flow === "invited" ? raw.flow : null;
  return {
    rider: { level: null, mainDiscipline: null, rideFrequency: null, primaryGoal: null, ...(raw.rider as Partial<RiderDraft>) },
    horses,
    editingIndex: Math.max(0, Math.min(Math.floor(index), horses.length - 1)),
    flow,
  };
}

/** Le brouillon contient-il quelque chose qui vaille la peine d'être repris ?
 * (au moins un cheval nommé) */
export function hasResumableDraft(draft: Pick<DraftState, "horses">): boolean {
  return draft.horses.some((h) => h.name.trim().length > 0);
}
