import { contactForAppointment, type Contact, type ContactRole } from "@/extras/model";

/**
 * Prochaine visite conseillée d'un contact (cf. docs/annuaire-professionnels.md,
 * phase 1) : à partir de son dernier rendez-vous passé et d'un rythme usuel par
 * métier. Une PROPOSITION affichée sur la fiche du contact : aucune notification
 * nouvelle (les rappels de rendez-vous existants suffisent). Logique pure, testée.
 */
const INTERVAL_DAYS: Partial<Record<ContactRole, number>> = {
  marechal: 49, // ferrure : 6 à 8 semaines, on prend 7
  dentiste: 365,
};

type ApptLike = { type: string; date: Date; professional: string | null };

export function nextVisitFor(
  contact: Contact,
  contacts: Contact[],
  appointments: ApptLike[],
  now: Date
): { last: Date; suggested: Date; overdue: boolean } | null {
  const days = INTERVAL_DAYS[contact.role];
  if (!days) return null;
  let last: Date | null = null;
  for (const a of appointments) {
    if (a.date.getTime() > now.getTime()) continue;
    if (contactForAppointment(contacts, a)?.id !== contact.id) continue;
    if (!last || a.date.getTime() > last.getTime()) last = a.date;
  }
  if (!last) return null;
  const suggested = new Date(last);
  suggested.setDate(suggested.getDate() + days);
  return { last, suggested, overdue: suggested.getTime() < now.getTime() };
}

/** Itinéraire dans Plans (aucune carte dans l'app, rien n'est envoyé à un tiers par nous). */
export function mapsUrl(address: string): string | null {
  const a = address.trim();
  return a ? `http://maps.apple.com/?daddr=${encodeURIComponent(a)}` : null;
}
