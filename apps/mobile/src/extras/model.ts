/**
 * Fiches complémentaires d'un cheval (identité, alimentation) et carnet de
 * contacts du cavalier — logique pure, testée (model.test.ts). Stockage et
 * synchro : extras/store.ts.
 *
 * Identité et alimentation vivent dans une ligne par cheval (table
 * horse_details), partagée avec la demi-pension ou le coach comme le reste du
 * cheval : c'est précisément à eux que la ration doit être lisible. Les
 * contacts sont personnels (table rider_contacts).
 */

export type HorseIdentity = {
  /** Numéro SIRE (France), ex. 25012345K. */
  sire: string;
  /** Identifiant européen à 15 caractères, ex. 250001A12345678. */
  ueln: string;
  /** Transpondeur, 15 chiffres. */
  microchip: string;
  insurer: string;
  insurancePolicy: string;
  /** Écurie / pension où vit le cheval. */
  stable: string;
};

export type FeedingMeal = { id: string; label: string; ration: string };

export type FeedingPlan = {
  meals: FeedingMeal[];
  hay: string;
  supplements: string;
  /** Consignes : allergies, eau, ce qu'il ne faut jamais donner… */
  notes: string;
};

/**
 * Demi-pension (Premium) : qui monte, quels jours, et sa participation aux
 * frais. Jours ISO : 1 = lundi … 7 = dimanche.
 */
export type Partnership = {
  riderName: string;
  days: number[];
  /** Participation mensuelle en euros, null si aucune. */
  monthlyFee: number | null;
  notes: string;
};

export const EMPTY_PARTNERSHIP: Partnership = { riderName: "", days: [], monthlyFee: null, notes: "" };

export type HorseDetails = {
  horseId: string;
  identity: HorseIdentity;
  feeding: FeedingPlan;
  partnership: Partnership;
  /** ISO, pour la fusion « la plus récente gagne » (cf. mergeByUpdatedAt). */
  updatedAt: string;
};

export type ContactRole = "veto" | "marechal" | "osteo" | "dentiste" | "coach" | "pension" | "autre";

export type Contact = {
  id: string;
  name: string;
  role: ContactRole;
  phone: string;
  email: string;
  notes: string;
  updatedAt: string;
};

export const EMPTY_IDENTITY: HorseIdentity = {
  sire: "",
  ueln: "",
  microchip: "",
  insurer: "",
  insurancePolicy: "",
  stable: "",
};

export function emptyFeeding(labels: [string, string, string]): FeedingPlan {
  return {
    meals: labels.map((label, i) => ({ id: `m${i + 1}`, label, ration: "" })),
    hay: "",
    supplements: "",
    notes: "",
  };
}

/** Lecture tolérante d'une ligne JSON (serveur ou fichier local). */
export function normalizeDetails(
  horseId: string,
  raw: { identity?: unknown; feeding?: unknown; partnership?: unknown; updatedAt?: unknown } | null | undefined,
  defaultMeals: [string, string, string]
): HorseDetails {
  const id = (raw?.identity ?? {}) as Partial<HorseIdentity>;
  const fd = (raw?.feeding ?? {}) as Partial<FeedingPlan>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const pr = (raw?.partnership ?? {}) as Partial<Partnership>;
  const fee = typeof pr.monthlyFee === "number" && Number.isFinite(pr.monthlyFee) && pr.monthlyFee > 0 ? pr.monthlyFee : null;
  const days = Array.isArray(pr.days)
    ? [...new Set(pr.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
    : [];
  const meals = Array.isArray(fd.meals)
    ? fd.meals
        .filter((m): m is FeedingMeal => !!m && typeof m === "object")
        .map((m, i) => ({ id: str(m.id) || `m${i + 1}`, label: str(m.label), ration: str(m.ration) }))
    : emptyFeeding(defaultMeals).meals;
  return {
    horseId,
    identity: {
      sire: str(id.sire),
      ueln: str(id.ueln),
      microchip: str(id.microchip),
      insurer: str(id.insurer),
      insurancePolicy: str(id.insurancePolicy),
      stable: str(id.stable),
    },
    feeding: { meals, hay: str(fd.hay), supplements: str(fd.supplements), notes: str(fd.notes) },
    partnership: { riderName: str(pr.riderName), days, monthlyFee: fee, notes: str(pr.notes) },
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
  };
}

// --- Contrôles de format (indicatifs : on prévient, on n'empêche pas) ------

const compact = (s: string) => s.replace(/[\s.-]/g, "").toUpperCase();

/** SIRE : 8 chiffres et une lettre de contrôle. */
export function isPlausibleSire(value: string): boolean {
  return value.trim() === "" || /^\d{8}[A-Z]$/.test(compact(value));
}

/** UELN : 15 caractères alphanumériques. */
export function isPlausibleUeln(value: string): boolean {
  return value.trim() === "" || /^[0-9A-Z]{15}$/.test(compact(value));
}

/** Transpondeur ISO 11784 : 15 chiffres. */
export function isPlausibleMicrochip(value: string): boolean {
  return value.trim() === "" || /^\d{15}$/.test(compact(value));
}

export function hasIdentity(identity: HorseIdentity): boolean {
  return Object.values(identity).some((v) => v.trim() !== "");
}

export function hasFeeding(feeding: FeedingPlan): boolean {
  return (
    feeding.meals.some((m) => m.ration.trim() !== "") ||
    [feeding.hay, feeding.supplements, feeding.notes].some((v) => v.trim() !== "")
  );
}

// --- Demi-pension --------------------------------------------------------------

export function hasPartnership(p: Partnership): boolean {
  return p.riderName.trim() !== "" || p.days.length > 0 || p.monthlyFee !== null;
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

export function isPartnerDay(p: Partnership, d: Date): boolean {
  return p.riderName.trim() !== "" && p.days.includes(isoWeekday(d));
}

/** Ce qui reste à la charge du propriétaire sur un mois : jamais négatif. */
export function netMonthlyCost(monthExpenses: number, p: Partnership): number {
  return Math.max(0, Math.round((monthExpenses - (p.monthlyFee ?? 0)) * 100) / 100);
}

// --- Contacts ------------------------------------------------------------------

/** Lien d'appel : chiffres et « + » seulement (rien d'autre n'atteint le
 * composeur, un numéro mal saisi ne peut pas ouvrir autre chose). */
export function telUrl(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\+/g, "").length >= 6 ? `tel:${digits}` : null;
}

/** Type de rendez-vous → rôle du professionnel attendu. */
const ROLE_FOR_APPOINTMENT: Partial<Record<string, ContactRole>> = {
  veto: "veto",
  vaccination: "veto",
  vermifuge: "veto",
  traitement: "veto",
  marechal: "marechal",
  osteo: "osteo",
  dentiste: "dentiste",
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Contact d'un rendez-vous : celui dont le nom correspond au professionnel
 * saisi, sinon — s'il n'y en a qu'un — le seul contact du bon métier.
 */
export function contactForAppointment(
  contacts: Contact[],
  appointment: { type: string; professional: string | null }
): Contact | null {
  const pro = appointment.professional ? norm(appointment.professional) : "";
  if (pro) {
    const byName = contacts.find((c) => norm(c.name) === pro || (norm(c.name).length > 2 && pro.includes(norm(c.name))));
    if (byName) return byName;
  }
  const role = ROLE_FOR_APPOINTMENT[appointment.type];
  if (!role) return null;
  const sameRole = contacts.filter((c) => c.role === role);
  return sameRole.length === 1 ? sameRole[0] : null;
}

/** Contacts proposés dans un formulaire de rendez-vous : le bon métier d'abord. */
export function suggestedContacts(contacts: Contact[], appointmentType: string): Contact[] {
  const role = ROLE_FOR_APPOINTMENT[appointmentType];
  return [...contacts].sort((a, b) => {
    const ra = a.role === role ? 0 : 1;
    const rb = b.role === role ? 0 : 1;
    return ra - rb || a.name.localeCompare(b.name);
  });
}

// --- Fusion avec le serveur ----------------------------------------------------

/**
 * Fusion « la plus récente gagne » ligne par ligne, sauf pour les lignes
 * encore en attente d'envoi (`pending`) : la version locale, plus récente
 * par définition, est gardée. Une ligne absente du serveur et non en attente
 * a été supprimée ailleurs — sauf si elle vient d'être créée ici, après le
 * début de la relecture. `keepMissing` : une absence côté serveur ne prouve
 * rien (fiche d'un cheval, jamais supprimée seule) — la ligne locale reste.
 */
export function mergeByUpdatedAt<T extends { updatedAt: string }>(
  local: T[],
  remote: T[],
  key: (item: T) => string,
  pending: Set<string>,
  pullStartedAt: number,
  keepMissing = false
): T[] {
  const remoteByKey = new Map(remote.map((r) => [key(r), r]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const l of local) {
    const k = key(l);
    seen.add(k);
    const r = remoteByKey.get(k);
    if (pending.has(k)) out.push(l);
    else if (!r) {
      if (keepMissing || Date.parse(l.updatedAt) >= pullStartedAt) out.push(l);
    } else out.push(Date.parse(r.updatedAt) > Date.parse(l.updatedAt) ? r : l);
  }
  for (const r of remote) if (!seen.has(key(r))) out.push(r);
  return out;
}
