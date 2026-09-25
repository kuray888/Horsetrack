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

/** Email de connexion (Supabase Auth) — seule adresse de confiance pour
 * écrire à un utilisateur. `public.users.email` n'en est qu'une copie faite à
 * l'inscription : jamais remise à jour quand l'email change, et longtemps
 * modifiable par l'utilisateur lui-même (cf. rls.sql protect_user_email).
 * null si le compte n'existe plus ou si la lecture échoue. */
export async function getAuthEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

/** Supprime tous les fichiers d'un dossier d'un bucket (un niveau + le
 * sous-dossier `journal/` des photos de cheval). Best-effort : renvoie le
 * nombre de fichiers supprimés, sans jamais rejeter. */
export async function removeStorageFolder(bucket: string, folder: string): Promise<number> {
  let removed = 0;
  try {
    // Borné : une suppression qui « réussit » sans rien retirer relisterait
    // indéfiniment les mêmes fichiers.
    for (let pass = 0; pass < 50; pass++) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, { limit: 100 });
      if (error || !data || data.length === 0) break;
      // Les sous-dossiers apparaissent comme des entrées sans `id`.
      const files = data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
      const subfolders = data.filter((f) => !f.id).map((f) => `${folder}/${f.name}`);
      for (const sub of subfolders) removed += await removeStorageFolder(bucket, sub);
      if (files.length === 0) break;
      const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(files);
      if (removeError) break;
      removed += files.length;
    }
  } catch {
    // best-effort
  }
  return removed;
}
