import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase de l'espace gestionnaire : clé publique (anon) et SESSION
 * de la personne — jamais de clé de service. Ce qu'elle voit est décidé par
 * les règles RLS de la base (packages/db/prisma/rls.sql), pas par ce site.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const gestionConfigured = Boolean(URL_ && KEY);

let client: SupabaseClient | null = null;

export function getGestionClient(): SupabaseClient | null {
  if (!URL_ || !KEY) return null;
  client ??= createClient(URL_, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "horsetrack-gestion-auth" },
  });
  return client;
}
