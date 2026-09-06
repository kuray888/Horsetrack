import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// Le vrai routeur (react-navigation, vendored par expo-router) utilisé par le
// Stack racine de l'app. On l'importe directement plutôt que de le mocker :
// ce test doit prouver le comportement RÉEL de la navigation, pas une
// hypothèse sur ce comportement.
import { StackRouter } from "expo-router/build/react-navigation/routers/StackRouter.js";

type StackRoute = { key: string; name: string; params: Record<string, unknown> | undefined };
type StackState = {
  key: string;
  index: number;
  routeNames: string[];
  routes: StackRoute[];
  preloadedRoutes: StackRoute[];
  stale: false;
  type: "stack";
};
type StackActionType = "PUSH" | "NAVIGATE" | "POP_TO";

/**
 * Régression du crash Horse Hub → Entraînement/Concours/Journal/Budget/
 * Documents (cf. audit crash 2026-09-05, round 3).
 *
 * Horse Hub (`app/horse/[id]/index.tsx`) est empilé AU-DESSUS de `(tabs)` sur
 * le Stack racine (cf. `app/_layout.tsx` : "(tabs)" et "horse/[id]/index" sont
 * frères). Ce test reconstruit exactement cet état de pile et rejoue, avec le
 * VRAI réducteur `StackRouter` (pas un mock), les trois actions que
 * `router.push` / `router.navigate` / `router.dismissTo` produisent pour
 * `router.<method>("/(tabs)/planning?filter=session")` — et vérifie combien
 * d'instances de "(tabs)" se retrouvent dans la pile résultante.
 *
 * Preuve (voir aussi le commentaire dans index.tsx) : sans `getId`/`singular`
 * configuré sur l'écran "(tabs)" du root Stack (ce n'est pas le cas ici),
 * PUSH et NAVIGATE ne retrouvent QUE la route actuellement focus (Horse Hub)
 * — pas "(tabs)" plus bas dans la pile — donc les deux empilent une SECONDE
 * instance de "(tabs)". Seul POP_TO (= `router.dismissTo`) recherche une
 * route existante par nom dans TOUTE la pile et y revient sans la dupliquer.
 * C'est ce qui causait le crash natif (deux instances du navigateur de tabs
 * coexistant) et pourquoi `router.dismissTo` doit rester la méthode utilisée
 * dans `index.tsx` pour toute navigation vers `(tabs)`.
 *
 * Ce test vit sous `src/` (et non `app/`) volontairement : un premier essai
 * placé dans `app/horse/[id]/index.test.ts` a fait échouer le build EAS —
 * expo-router balaie tout `app/` via `require.context` pour découvrir les
 * routes, y compris les fichiers `.test.ts`, et Metro ne peut pas résoudre
 * `node:fs`/`node:path` dans ce bundle (pas de polyfill Node/Hermes). Tous
 * les autres tests du projet vivent déjà sous `src/` pour la même raison.
 */
function rootStackStateWithHorseHubOnTop(): StackState {
  return {
    key: "root-stack-key",
    // Horse Hub (dernier poussé) a le focus, (tabs) est déjà monté en dessous.
    index: 2,
    routeNames: ["index", "(tabs)", "horse/[id]/index"],
    routes: [
      { key: "index-key-1", name: "index", params: undefined },
      { key: "tabs-key-1", name: "(tabs)", params: { screen: "chevaux", params: {} } },
      { key: "horse-key-1", name: "horse/[id]/index", params: { id: "abc123" } },
    ],
    preloadedRoutes: [],
    stale: false,
    type: "stack",
  };
}

// Reproduit exactement `options.routeGetIdList` tel qu'il est construit par
// react-navigation à partir des props `<Stack.Screen>` (cf.
// useNavigationBuilder.js) : vide, car `app/_layout.tsx` ne passe ni `getId`
// ni `singular` sur `<Stack.Screen name="(tabs)" />`.
const options = {
  routeNames: ["index", "(tabs)", "horse/[id]/index"],
  routeParamList: {},
  routeGetIdList: {},
};

function dispatch(actionType: StackActionType): StackState {
  const state = rootStackStateWithHorseHubOnTop();
  const action = {
    type: actionType,
    target: state.key,
    payload: { name: "(tabs)", params: { screen: "planning", params: { filter: "session" } } },
  };
  const router = StackRouter({});
  return router.getStateForAction(state, action, options) as StackState;
}

describe("Horse Hub → (tabs) navigation (vrai StackRouter, pas un mock)", () => {
  it("PUSH duplique le navigateur (tabs) — documente pourquoi push est proscrit ici", () => {
    const result = dispatch("PUSH");
    expect(result.routes.filter((r) => r.name === "(tabs)")).toHaveLength(2);
  });

  it("NAVIGATE duplique AUSSI le navigateur (tabs) — documente pourquoi navigate ne suffit pas ici", () => {
    const result = dispatch("NAVIGATE");
    expect(result.routes.filter((r) => r.name === "(tabs)")).toHaveLength(2);
  });

  it("dismissTo (POP_TO) réutilise l'instance (tabs) existante sans la dupliquer", () => {
    const before = rootStackStateWithHorseHubOnTop();
    const result = dispatch("POP_TO");
    const tabsEntries = result.routes.filter((r) => r.name === "(tabs)");
    expect(tabsEntries).toHaveLength(1);
    // La clé de l'instance "(tabs)" doit être la MÊME qu'avant navigation —
    // preuve que c'est la même instance native qui est réutilisée, pas une
    // nouvelle qui porte juste le même nom.
    expect(tabsEntries[0].key).toBe(before.routes[1].key);
    // Horse Hub est dismiss (sorti de la pile), comme attendu pour un saut
    // vers un onglet principal.
    expect(result.routes.some((r) => r.name === "horse/[id]/index")).toBe(false);
  });
});

// Garde statique complémentaire (rapide, mais volontairement pas la seule
// preuve) : aucune navigation de ce fichier vers (tabs) ne doit utiliser
// router.push ou router.navigate — seul router.dismissTo est prouvé sûr
// ci-dessus.
describe("Horse Hub navigation source", () => {
  it("never uses router.push/router.navigate to jump into (tabs) from this screen", () => {
    const source = readFileSync(path.resolve(__dirname, "../../app/horse/[id]/index.tsx"), "utf8");
    const unsafeJump = source.match(/router\.(push|navigate)\([\s\S]{0,80}?\(tabs\)/g);
    expect(unsafeJump).toBeNull();
  });
});
