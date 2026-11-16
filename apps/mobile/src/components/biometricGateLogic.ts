/**
 * État du verrou à l'ouverture. Verrou actif et session présente (ou illisible) :
 * verrouillé. Une erreur de lecture ne doit jamais ouvrir l'app à quelqu'un
 * qui n'a pas passé Face ID ; sans verrou activé, ou sans session (rien à
 * protéger), l'app s'ouvre.
 */
export function resolveGateStatus(input: {
  /** "unknown" : le réglage n'a pas pu être lu (trousseau encore fermé). */
  lockEnabled: boolean | "unknown";
  session: "present" | "absent" | "unknown";
}): "checking" | "locked" | "unlocked" {
  if (input.session === "absent") return "unlocked";
  // Réglage illisible : on ne sait pas si le verrou est actif. Ni ouvrir (fuite)
  // ni demander Face ID à qui ne l'a pas activé : on revérifie plus tard.
  if (input.lockEnabled === "unknown") return "checking";
  return input.lockEnabled ? "locked" : "unlocked";
}
