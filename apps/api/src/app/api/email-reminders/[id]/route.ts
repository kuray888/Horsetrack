import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

/** Annule un rappel email programmé (cf. agenda.tsx `deleteAppointment`,
 * miroir de `cancelReminder` pour le push local). Le `where` inclut `userId`
 * plutôt qu'un simple `id` : un utilisateur ne peut jamais supprimer le
 * rappel d'un autre, RLS ou pas (cette route bypass RLS via DATABASE_URL). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  await db.emailReminder.deleteMany({ where: { id, userId } });

  return NextResponse.json({ deleted: true });
}
