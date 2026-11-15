/**
 * Empêche d'ouvrir deux fois l'écran suivant. Sur l'écran « discipline », le
 * passage à l'écran suivant peut partir de deux endroits (la minuterie après
 * le choix, ou « Continuer ») et un second toucher pendant la transition
 * relançait la minuterie : le nom du cheval s'ouvrait, puis se rouvrait une
 * fraction de seconde plus tard. Une fois parti, on n'avance plus tant que
 * l'écran n'a pas retrouvé le focus (retour arrière).
 */
export function createAdvanceGuard() {
  let advanced = false;
  return {
    /** Vrai une seule fois, jusqu'à `reset`. */
    tryAdvance(): boolean {
      if (advanced) return false;
      advanced = true;
      return true;
    },
    get advanced() {
      return advanced;
    },
    reset() {
      advanced = false;
    },
  };
}
