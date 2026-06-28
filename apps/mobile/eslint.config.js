// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // vitest n'est résolvable que via npx sur cette machine (pnpm install
    // cassé pour une raison indépendante, cf. metro-core) — jamais comme
    // module local, donc import/no-unresolved doit ignorer les fichiers de
    // test plutôt que de les faire échouer au lint.
    ignores: ["dist/*", "**/*.test.ts", "**/*.test.tsx"],
  }
]);
