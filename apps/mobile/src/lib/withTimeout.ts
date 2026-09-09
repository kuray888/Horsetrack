/**
 * Le client Supabase n'a aucun timeout configuré (cf. lib/supabase.ts) — sur
 * une connexion lente (pas coupée, juste très lente), un appel réseau peut
 * rester en attente des dizaines de secondes avant que l'OS ne finisse par
 * l'abandonner, pendant lesquelles l'écran affiche juste un bouton désactivé
 * figé ("Connexion...") sans aucun signe de progression (cf. audit du
 * 2026-09-09). Ce timeout explicite, plus court, donne un message dédié
 * avant que l'utilisateur ne pense que l'app est plantée.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
