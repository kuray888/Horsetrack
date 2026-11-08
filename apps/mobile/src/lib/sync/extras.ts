import { supabase } from "@/lib/supabase";
import type { Contact, HorseDetails } from "@/extras/model";
import { selectWithOptionalColumns, settleWrite, upsertWithOptionalColumns } from "./shared";

/** Fiche du cheval (identité, alimentation, demi-pension) et contacts.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

/**
 * Fiche complémentaire d'un cheval (identité, alimentation) : une ligne par
 * cheval, même portée de partage que ses séances (cf. extras/model.ts).
 */
export async function pushHorseDetailsImpl(details: HorseDetails, stamp?: number): Promise<void> {
  const row = {
    horseId: details.horseId,
    identity: details.identity,
    feeding: details.feeding,
    partnership: details.partnership,
    updatedAt: details.updatedAt,
  };
  await upsertWithOptionalColumns("pushHorseDetails", "horse_details", details.horseId, row, ["partnership"], stamp);
}
/** Lignes brutes, relues par extras/store.ts (normalizeDetails). null si
 * la lecture échoue — table absente comprise. */
type HorseDetailsRow = { horseId: string; identity: unknown; feeding: unknown; partnership?: unknown; updatedAt: string };
export async function pullHorseDetails(): Promise<HorseDetailsRow[] | null> {
  return selectWithOptionalColumns<HorseDetailsRow>("horse_details", "horseId, identity, feeding, updatedAt", ["partnership"]);
}
/** Carnet de contacts : personnel au cavalier (RLS userId = auth.uid()). */
export async function pushContactImpl(contact: Contact, stamp?: number): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const row = { ...contact, userId };
  const { error } = await supabase.from("rider_contacts").upsert(row);
  await settleWrite("pushContact", "rider_contacts", contact.id, error, row, stamp);
}
export async function deleteContactRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("rider_contacts").delete().eq("id", id);
  await settleWrite("deleteContactRemote", "rider_contacts", id, error, undefined, stamp);
}
export async function pullContacts(): Promise<Contact[] | null> {
  const { data, error } = await supabase
    .from("rider_contacts")
    .select("id, name, role, phone, email, notes, updatedAt");
  if (error || !data) return null;
  return data as Contact[];
}
