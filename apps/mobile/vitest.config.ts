import path from "node:path";

// Pas d'import depuis "vitest/config" ici : tant que `pnpm install` reste
// cassé sur Windows pour cette app (cf. bug metro-core indépendant, pas lié
// aux tests), vitest n'est disponible que via `npx`, donc seul `vitest`
// lui-même (le binaire) est garanti résolvable — pas ses sous-chemins
// d'import depuis ce fichier de config. `defineConfig` n'est qu'un helper de
// typage : un objet simple fonctionne à l'identique à l'exécution.
export default {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
};
