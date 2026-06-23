import { createClient } from "@supabase/supabase-js";

/**
 * Client service_role — vérifie les tokens de session envoyés par le mobile
 * (jamais exposé au client). Source du userId pour toute route qui doit
 * savoir "qui appelle" sans repasser par Supabase Auth côté client.
 */
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice("Bearer ".length));
  if (error || !data.user) return null;
  return data.user.id;
}

/** Supprime définitivement le compte Supabase Auth — à appeler une fois les
 * données Prisma déjà supprimées (cf. /api/account), pas l'inverse : sinon un
 * échec de suppression des données laisserait un compte fantôme sans profil. */
export async function deleteSupabaseAuthUser(userId: string) {
  return supabaseAdmin.auth.admin.deleteUser(userId);
}
