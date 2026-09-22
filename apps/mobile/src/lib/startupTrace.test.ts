import { describe, expect, it } from "vitest";
import { StartupTrace, formatTrace, summarizeTrace } from "@/lib/startupTrace";

/** Horloge pilotée à la main : les durées testées ici doivent être exactes,
 * jamais dépendantes de la vitesse de la machine qui fait tourner les tests. */
function fakeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("StartupTrace", () => {
  it("date les instants depuis la création de la trace, pas depuis l'époque", () => {
    const clock = fakeClock();
    const trace = new StartupTrace(clock.now);
    clock.advance(42);
    trace.mark("police chargée");
    expect(trace.report()).toEqual([{ name: "police chargée", startedAt: 42, durationMs: null }]);
  });

  it("mesure la durée d'une span entre son ouverture et sa fermeture", () => {
    const clock = fakeClock();
    const trace = new StartupTrace(clock.now);
    clock.advance(10);
    const end = trace.start("lecture séances");
    clock.advance(30);
    end();
    expect(trace.report()).toEqual([{ name: "lecture séances", startedAt: 10, durationMs: 30 }]);
  });

  it("ignore une seconde fermeture, pour ne pas allonger la durée après coup", () => {
    const clock = fakeClock();
    const trace = new StartupTrace(clock.now);
    const end = trace.start("lecture");
    clock.advance(5);
    end();
    clock.advance(100);
    end();
    expect(trace.report()[0].durationMs).toBe(5);
  });

  it("laisse une span jamais fermée sans durée — un chargement qui ne finit pas doit se voir", () => {
    const trace = new StartupTrace(fakeClock().now);
    trace.start("lecture qui ne revient jamais");
    expect(trace.report()[0].durationMs).toBeNull();
  });

  it("measure rend le résultat et ferme la span", async () => {
    const clock = fakeClock();
    const trace = new StartupTrace(clock.now);
    const value = await trace.measure("lecture", async () => {
      clock.advance(7);
      return "contenu";
    });
    expect(value).toBe("contenu");
    expect(trace.report()[0].durationMs).toBe(7);
  });

  it("measure laisse passer l'erreur et ferme quand même la span", async () => {
    const clock = fakeClock();
    const trace = new StartupTrace(clock.now);
    await expect(
      trace.measure("lecture qui échoue", async () => {
        clock.advance(3);
        throw new Error("disque plein");
      })
    ).rejects.toThrow("disque plein");
    // La mesure ne doit rien avaler : l'appelant garde ses chemins de repli.
    expect(trace.report()[0].durationMs).toBe(3);
  });

  it("trie le rapport par ordre de début, quel que soit l'ordre des fermetures", async () => {
    const clock = fakeClock();
    const trace = new StartupTrace(clock.now);
    const longue = trace.start("longue");
    clock.advance(5);
    const courte = trace.start("courte");
    clock.advance(1);
    courte();
    clock.advance(20);
    longue();
    expect(trace.report().map((e) => e.name)).toEqual(["longue", "courte"]);
  });

  it("borne le nombre d'entrées, en gardant les premières", () => {
    const trace = new StartupTrace(fakeClock().now);
    for (let i = 0; i < 500; i++) trace.mark(`repère ${i}`);
    const report = trace.report();
    expect(report).toHaveLength(200);
    expect(report[0].name).toBe("repère 0");
  });
});

describe("formatTrace", () => {
  it("aligne les colonnes, n'affiche de durée que pour les spans, sans espaces en fin de ligne", () => {
    const texte = formatTrace([
      { name: "police", startedAt: 12, durationMs: null },
      { name: "lecture séances", startedAt: 20, durationMs: 34 },
    ]);
    expect(texte).toBe(["   12ms  police", "   20ms  lecture séances (34ms)"].join("\n"));
  });

  it("le dit quand il n'y a rien à montrer", () => {
    expect(formatTrace([])).toBe("Aucune mesure.");
  });
});

describe("summarizeTrace", () => {
  const lectures = [
    { name: "montage du layout racine", startedAt: 5, durationMs: null },
    { name: "lecture horses_v1", startedAt: 10, durationMs: 40 },
    { name: "lecture training_sessions_v1", startedAt: 12, durationMs: 25 },
  ];

  it("ne compte que les lectures, pas les repères ponctuels", () => {
    expect(summarizeTrace(lectures)[0]).toBe("2 lecture(s), 65ms cumulés");
  });

  it("déduit la fin du chargement de la dernière lecture terminée", () => {
    // 10 + 40 = 50, contre 12 + 25 = 37 : c'est la plus tardive qui compte,
    // pas la dernière démarrée.
    expect(summarizeTrace(lectures)[1]).toBe("dernière lecture terminée à 50ms");
  });

  it("désigne la lecture la plus lente — c'est elle qu'on irait regarder", () => {
    expect(summarizeTrace(lectures)[2]).toBe("plus lente : lecture horses_v1 (40ms)");
  });

  it("signale les lectures jamais terminées plutôt que de les passer sous silence", () => {
    const summary = summarizeTrace([...lectures, { name: "lecture bloquée", startedAt: 1, durationMs: null }]);
    expect(summary[3]).toBe("1 lecture(s) jamais terminée(s)");
  });

  it("le dit quand aucune lecture n'a été mesurée", () => {
    expect(summarizeTrace([{ name: "police chargée", startedAt: 3, durationMs: null }])).toEqual([
      "Aucune lecture mesurée.",
    ]);
  });
});
