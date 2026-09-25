import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client service_role — vérifie les tokens de session envoyés par le mobile
 * (jamais exposé au client). Source du userId pour toute route qui doit
 * savoir "qui appelle" sans repasser par Supabase Auth côté client.
 *
 * Créé à la PREMIÈRE utilisation, pas au chargement du module : Next.js charge
 * chaque route pendant `next build` pour collecter ses pages, et un
 * `createClient` exécuté à l'import y échouait avec « supabaseUrl is required »
 * dès que les variables d'environnement ne sont pas fournies à la construction
 * (aperçus Vercel, cf. déploiements en erreur des branches d'aperçu). Une
 * variable manquante ne fait désormais échouer que la requête concernée, avec
 * un message explicite.
 */
let client: SupabaseClient | null = null;

function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies pour cet environnement.");
  }
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const { data, error } = await supabaseAdmin().auth.getUser(auth.slice("Bearer ".length));
  if (error || !data.user) return null;
  return data.user.id;
}

/** Supprime définitivement le compte Supabase Auth — à appeler une fois les
 * données Prisma déjà supprimées (cf. /api/account), pas l'inverse : sinon un
 * échec de suppression des données laisserait un compte fantôme sans profil. */
export async function deleteSupabaseAuthUser(userId: string) {
  return supabaseAdmin().auth.admin.deleteUser(userId);
}

/** Email de connexion (Supabase Auth) — seule adresse de confiance pour
 * écrire à un utilisateur. `public.users.email` n'en est qu'une copie faite à
 * l'inscription : jamais remise à jour quand l'email change, et longtemps
 * modifiable par l'utilisateur lui-même (cf. rls.sql protect_user_email).
 * null si le compte n'existe plus ou si la lecture échoue. */
export async function getAuthEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId);
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
      const { data, error } = await supabaseAdmin().storage.from(bucket).list(folder, { limit: 100 });
      if (error || !data || data.length === 0) break;
      // Les sous-dossiers apparaissent comme des entrées sans `id`.
      const files = data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
      const subfolders = data.filter((f) => !f.id).map((f) => `${folder}/${f.name}`);
      for (const sub of subfolders) removed += await removeStorageFolder(bucket, sub);
      if (files.length === 0) break;
      const { error: removeError } = await supabaseAdmin().storage.from(bucket).remove(files);
      if (removeError) break;
      removed += files.length;
    }
  } catch {
    // best-effort
  }
  return removed;
}
