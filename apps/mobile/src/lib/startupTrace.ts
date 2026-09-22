/**
 * Chronométrage du démarrage — MESURE UNIQUEMENT, aucune optimisation.
 *
 * Pourquoi ce module existe : le démarrage monte neuf providers qui lisent
 * chacun leur fichier JSON (cf. lib/localStore.ts), et personne n'avait jamais
 * chronométré quoi que ce soit. Sans chiffres, toute « optimisation » revient à
 * déplacer du code au hasard et à risquer une régression pour un gain nul. On
 * pose donc d'abord des repères, on lit les mesures sur un vrai iPhone avec de
 * vraies données, et on décide ensuite — ou on ne décide rien, si tout va bien.
 *
 * Ce que ce module NE mesure pas : le temps de lancement natif (avant que le
 * premier module JS ne soit évalué). L'obtenir demanderait une dépendance
 * native, et une dépendance native a déjà fait planter l'app au lancement en
 * TestFlight (cf. lib/imagePicker.ts). L'origine des mesures est donc le
 * premier `Date.now()` de ce fichier, et les chiffres sont à lire comme « temps
 * passé dans le JS », pas comme « temps entre le tap et l'écran ».
 *
 * Volontairement sans import de `react-native` : c'est ce qui le rend testable
 * sous Vitest (mêmes règles que search/search.ts ou horses/selectableHorses.ts).
 */

/** Horloge injectable — la vraie est `Date.now`. Une horloge en paramètre est
 * le seul moyen de tester des durées sans rendre les tests dépendants de la
 * vitesse de la machine. Millisecondes : `performance.now` serait plus fin,
 * mais les spans qui nous intéressent se comptent en dizaines de ms et son
 * origine diffère selon les moteurs. */
export type Clock = () => number;

export type TraceEntry = {
  name: string;
  /** Millisecondes écoulées depuis l'origine de la trace, au DÉBUT de l'entrée. */
  startedAt: number;
  /** Durée en millisecondes, ou `null` pour un instant ponctuel (`mark`) et
   * pour une span jamais terminée (ce qui est en soi une information : le
   * chargement n'est pas allé au bout). */
  durationMs: number | null;
};

/** Borne dure du nombre d'entrées conservées. Le traçage tourne aussi en
 * production (il ne coûte qu'un `Date.now()` et une entrée de tableau), et une
 * app laissée ouverte des heures ne doit pas voir ce tableau grossir sans fin.
 * Au-delà, on ignore les nouvelles entrées plutôt que d'évincer les anciennes :
 * ce sont les toutes premières qui décrivent le démarrage. */
const MAX_ENTRIES = 200;

export class StartupTrace {
  private readonly now: Clock;
  private readonly origin: number;
  private readonly entries: TraceEntry[] = [];
  /** Spans ouvertes, par nom. Une span rouverte sous le même nom pendant que la
   * précédente court écrase la précédente, qui restera donc sans durée — c'est
   * le comportement voulu : deux lectures concurrentes de la même clé seraient
   * un bug à voir, pas une mesure à moyenner. */
  private readonly open = new Map<string, TraceEntry>();

  constructor(now: Clock = Date.now) {
    this.now = now;
    this.origin = now();
  }

  /** Enregistre un instant ponctuel (« la police est chargée », « première
   * frame »). */
  mark(name: string): void {
    this.push({ name, startedAt: this.now() - this.origin, durationMs: null });
  }

  /** Ouvre une span nommée et rend la fonction qui la ferme. Rendre le
   * terminateur plutôt qu'exposer un `end(name)` évite au code appelant de
   * retenir la clé — et le rend correct même si deux appels s'imbriquent. */
  start(name: string): () => void {
    const entry: TraceEntry = { name, startedAt: this.now() - this.origin, durationMs: null };
    this.push(entry);
    this.open.set(name, entry);
    let closed = false;
    return () => {
      // Idempotent : un `finally` peut se déclencher deux fois dans du code
      // réécrit plus tard, et on ne veut pas que la deuxième fermeture allonge
      // artificiellement la durée.
      if (closed) return;
      closed = true;
      entry.durationMs = this.now() - this.origin - entry.startedAt;
      if (this.open.get(name) === entry) this.open.delete(name);
    };
  }

  /** Enveloppe une promesse dans une span. Ne change NI le résultat NI les
   * erreurs : la mesure doit rester invisible pour le code mesuré, y compris
   * quand il échoue (les lectures de localStore ont des chemins de repli qu'on
   * veut continuer à voir échouer normalement). */
  async measure<T>(name: string, run: () => Promise<T>): Promise<T> {
    const end = this.start(name);
    try {
      return await run();
    } finally {
      end();
    }
  }

  /** Les entrées dans l'ordre où elles ont commencé. Copie défensive : le
   * rapport est lu par un écran, qui ne doit pas pouvoir toucher la trace. */
  report(): TraceEntry[] {
    return this.entries.slice().sort((a, b) => a.startedAt - b.startedAt);
  }

  /** Millisecondes écoulées depuis l'origine — pour dater un rapport. */
  elapsed(): number {
    return this.now() - this.origin;
  }

  private push(entry: TraceEntry): void {
    if (this.entries.length >= MAX_ENTRIES) return;
    this.entries.push(entry);
  }
}

/**
 * Met le rapport en texte lisible, une entrée par ligne. Utilisé par le log de
 * développement ET par l'écran de lecture sur l'appareil : un seul format, donc
 * ce qu'on lit dans le terminal est exactement ce qu'on lit sur l'iPhone.
 *
 * Les durées sont arrondies à l'entier : afficher des décimales sur une horloge
 * à la milliseconde laisserait croire à une précision qu'on n'a pas.
 */
export function formatTrace(entries: TraceEntry[]): string {
  if (entries.length === 0) return "Aucune mesure.";
  const width = Math.max(...entries.map((e) => e.name.length));
  return entries
    .map((e) => {
      const at = `${Math.round(e.startedAt)}ms`.padStart(7);
      const duration = e.durationMs === null ? "" : ` (${Math.round(e.durationMs)}ms)`;
      // `trimEnd` : sans durée à droite, le remplissage du nom ne laisserait
      // que des espaces en fin de ligne, pénibles à relire dans un terminal.
      return `${at}  ${e.name.padEnd(width)}${duration}`.trimEnd();
    })
    .join("\n");
}

/** Trace du processus courant. Créée à l'évaluation du module, c'est-à-dire au
 * plus tôt dans la vie du JS — d'où l'import volontairement placé en tête de
 * app/_layout.tsx. */
export const startupTrace = new StartupTrace();
