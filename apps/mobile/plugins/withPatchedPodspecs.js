const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Patche les podspecs des packages tiers qui utilisent encore l'ancienne
 * dépendance `React` (renommée en RN 0.71+). Sans ce patch, CocoaPods
 * échoue à résoudre les dépendances avec React Native 0.86.
 */
function withPatchedPodspecs(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const nodeModules = path.join(
        config.modRequest.projectRoot,
        "node_modules"
      );

      // react-native-shared-group-preferences : la dépendance "React" est
      // inutile (le package n'utilise que NSUserDefaults, pur Foundation iOS)
      // et casse pod install depuis RN 0.71+.
      const sgpPodspec = path.join(
        nodeModules,
        "react-native-shared-group-preferences",
        "RNReactNativeSharedGroupPreferences.podspec"
      );
      if (fs.existsSync(sgpPodspec)) {
        let content = fs.readFileSync(sgpPodspec, "utf8");
        // Supprime la ligne `s.dependency "React"` et ses variantes
        content = content.replace(/\s*s\.dependency\s+["']React["'][^\n]*\n/g, "\n");
        fs.writeFileSync(sgpPodspec, content);
      }

      return config;
    },
  ]);
}

module.exports = withPatchedPodspecs;
