/**
 * État du verrou à l'ouverture. Verrou actif et session présente (ou illisible) :
 * verrouillé. Une erreur de lecture ne doit jamais ouvrir l'app à quelqu'un
 * qui n'a pas passé Face ID ; sans verrou activé, ou sans session (rien à
 * protéger), l'app s'ouvre.
 */
export function resolveGateStatus(input: { lockEnabled: boolean; session: "present" | "absent" | "unknown" }): "locked" | "unlocked" {
  return input.lockEnabled && input.session !== "absent" ? "locked" : "unlocked";
}
